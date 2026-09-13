import hashlib
import json
import os
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.v2.dependencies import CurrentUser, DbSession, require_permission
from app.domain.enums import EmploymentStatus, Permission, Role
from app.domain.models import Award, Certification, Company, EmployeeSkill, Employment, Skill, User
from app.profile_extensions.models import (
    CompetencyRequest,
    PersonalDetails,
    ProfileActivityLog,
    StoredAsset,
)
from app.profile_extensions.schemas import (
    ActivityPatch,
    ActivityWrite,
    AdminDetailsPatch,
    DetailsPatch,
    EmploymentEnd,
    EmploymentWrite,
    ManagedSkillInsightRead,
    PersonalDetailsRead,
    RequestCreate,
    RequestReview,
)
from app.security.permissions import effective_permissions
from app.security.roles import can_manage_role
from app.talent_workflows.service import approved_assessment_averages

router = APIRouter(tags=["profile-extensions"])
SelfActor = Annotated[User, Depends(require_permission(Permission.PROFILE_SELF))]


@router.get("/skills-competency/insight/{user_id}", response_model=ManagedSkillInsightRead)
async def managed_skill_insight(user_id: uuid.UUID, db: DbSession, actor: CurrentUser):
    from app.career_ai.models import CareerGoal
    from app.talent_workflows.models import Assessment

    if Permission.PEOPLE_READ not in effective_permissions(actor):
        raise HTTPException(403, "Bạn chưa có quyền xem năng lực nhân sự")
    target = await target_user(db, actor, user_id)
    if not can_manage_role(actor.role, target.role):
        raise missing()
    details = await details_read(db, target.id)
    skills = (
        await db.execute(
            select(EmployeeSkill, Skill)
            .join(Skill, Skill.id == EmployeeSkill.skill_id)
            .where(
                EmployeeSkill.user_id == target.id, EmployeeSkill.company_id == target.company_id
            )
            .order_by(EmployeeSkill.updated_at.desc())
        )
    ).all()
    goals = (
        await db.execute(
            select(CareerGoal.status, func.count())
            .where(
                CareerGoal.owner_user_id == target.id, CareerGoal.company_id == target.company_id
            )
            .group_by(CareerGoal.status)
        )
    ).all()
    activities = await db.scalar(
        select(func.count())
        .select_from(ProfileActivityLog)
        .where(
            ProfileActivityLog.owner_user_id == target.id,
            ProfileActivityLog.company_id == target.company_id,
        )
    )
    assessments = await db.scalar(
        select(func.count())
        .select_from(Assessment)
        .where(Assessment.reviewee_id == target.id, Assessment.company_id == target.company_id)
    )
    assessment_scores = await approved_assessment_averages(db, target.id, target.company_id)
    return {
        "profile": {
            "id": str(target.id),
            "name": target.name,
            "jobTitle": target.job_title,
            "contributionScore": details["contributionScore"],
            "attitudeScore": details.get("attitudeScore"),
            **assessment_scores,
        },
        "skills": [
            {
                "id": str(item.id),
                "skillId": str(skill.id),
                "name": skill.name,
                "category": skill.category,
                "level": item.rating,
                "note": item.note,
                "sourceType": item.source_type.value,
            }
            for item, skill in skills
        ],
        "goalStatusCounts": {status: count for status, count in goals},
        "activityCount": activities,
        "assessmentsReceivedCount": assessments,
    }


def missing():
    return HTTPException(404, "Không tìm thấy nội dung hoặc bạn không có quyền truy cập")


async def target_user(db, actor, target_id):
    target = await db.get(User, target_id)
    if target is None or (
        actor.id != target.id
        and not (
            Permission.PEOPLE_READ in effective_permissions(actor)
            and can_manage_role(actor.role, target.role)
            and (actor.role == Role.SUPER_ADMIN or actor.company_id == target.company_id)
        )
    ):
        raise missing()
    return target


async def writable_target(db, actor, user_id):
    target = await db.get(User, user_id)
    if (
        target is None
        or Permission.PEOPLE_WRITE not in effective_permissions(actor)
        or not can_manage_role(actor.role, target.role)
        or (actor.role != Role.SUPER_ADMIN and actor.company_id != target.company_id)
    ):
        raise missing()
    return target


async def owned_asset(db, actor, asset_id):
    asset = await db.get(StoredAsset, asset_id)
    if (
        asset is None
        or asset.owner_user_id != actor.id
        or asset.company_id != actor.company_id
        or asset.deleted
    ):
        raise missing()
    return asset


def asset_read(asset):
    return {
        "id": str(asset.id),
        "filename": asset.filename,
        "mimeType": asset.mime_type,
        "size": asset.size,
        "purpose": asset.purpose,
        "downloadPath": f"/profile-extensions/assets/{asset.id}",
    }


async def details_read(db, user_id):
    details = await db.get(PersonalDetails, user_id)
    values = details.details if details else {}
    points = await db.scalar(
        select(func.coalesce(func.sum(CompetencyRequest.points_awarded), 0)).where(
            CompetencyRequest.sender_id == user_id, CompetencyRequest.status == "APPROVED"
        )
    )
    return {
        **values,
        "version": details.version if details else 0,
        "avatarAssetId": str(details.avatar_asset_id)
        if details and details.avatar_asset_id
        else None,
        "contributionScore": points + (values.get("contributionAdjustment", 0) or 0),
    }


@router.get("/profile-extensions/me", response_model=PersonalDetailsRead)
async def personal_details(db: DbSession, actor: SelfActor):
    return await details_read(db, actor.id)


@router.get("/profile-extensions/users/{user_id}", response_model=PersonalDetailsRead)
async def view_personal_details(user_id: uuid.UUID, db: DbSession, actor: CurrentUser):
    await target_user(db, actor, user_id)
    return await details_read(db, user_id)


async def save_details(db, user_id, payload):
    await db.execute(select(User.id).where(User.id == user_id).with_for_update())
    row = await db.get(PersonalDetails, user_id)
    if (row.version if row else 0) != payload.expectedVersion:
        raise HTTPException(409, "Hồ sơ đã thay đổi. Tải lại trước khi lưu.")
    if row is None:
        row = PersonalDetails(user_id=user_id, details={}, version=0)
        db.add(row)
    row.details = {
        **row.details,
        **payload.model_dump(
            mode="json", exclude_unset=True, exclude={"expectedVersion", "avatarAssetId"}
        ),
    }
    if "avatarAssetId" in payload.model_fields_set:
        row.avatar_asset_id = payload.avatarAssetId
    row.version += 1
    await db.commit()
    return await details_read(db, user_id)


@router.patch("/profile-extensions/me")
async def update_details(payload: DetailsPatch, db: DbSession, actor: SelfActor):
    if payload.avatarAssetId:
        asset = await owned_asset(db, actor, payload.avatarAssetId)
        if asset.purpose != "AVATAR":
            raise HTTPException(422, "Hãy chọn tệp ảnh đại diện")
    return await save_details(db, actor.id, payload)


@router.patch("/profile-extensions/people/{user_id}")
async def update_managed_details(
    user_id: uuid.UUID, payload: AdminDetailsPatch, db: DbSession, actor: CurrentUser
):
    await writable_target(db, actor, user_id)
    if "avatarAssetId" in payload.model_fields_set:
        raise HTTPException(422, "Ảnh đại diện do chủ hồ sơ cập nhật")
    return await save_details(db, user_id, payload)


@router.post("/profile-extensions/assets", status_code=201)
async def upload_asset(
    db: DbSession,
    actor: SelfActor,
    file: UploadFile,
    purpose: Literal["AVATAR", "EVIDENCE"] = "EVIDENCE",
):
    limit = (5 if purpose == "AVATAR" else 10) * 1024 * 1024
    content = await file.read(limit + 1)
    await file.close()
    if not content or len(content) > limit:
        raise HTTPException(413, f"Tệp phải có nội dung và tối đa {limit // 1024 // 1024} MB")
    images = {
        "image/jpeg": content.startswith(b"\xff\xd8\xff"),
        "image/png": content.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/webp": content.startswith(b"RIFF") and content[8:12] == b"WEBP",
        "image/gif": content.startswith((b"GIF87a", b"GIF89a")),
    }
    valid = images.get(file.content_type or "", False)
    if purpose == "EVIDENCE":
        office = {"application/msword", "application/vnd.ms-excel"}
        zipped = {
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
        valid = (
            valid
            or (file.content_type == "application/pdf" and content.startswith(b"%PDF-"))
            or (file.content_type in office and content.startswith(b"\xd0\xcf\x11\xe0"))
            or (file.content_type in zipped and content.startswith(b"PK\x03\x04"))
        )
    if not valid:
        raise HTTPException(
            422,
            "Định dạng không hợp lệ. Ảnh: JPEG, PNG, WebP, GIF. Minh chứng: ảnh, PDF và Office.",
        )
    asset = StoredAsset(
        id=uuid.uuid4(),
        owner_user_id=actor.id,
        company_id=actor.company_id,
        filename=Path(file.filename or "document").name[:255],
        mime_type=file.content_type,
        size=len(content),
        purpose=purpose,
    )
    directory = Path(os.environ.get("CAREERMATE_UPLOAD_DIR", "/app/uploads"))
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    path = directory / str(asset.id)
    with path.open("xb") as stream:
        stream.write(content)
    path.chmod(0o600)
    db.add(asset)
    try:
        await db.commit()
    except Exception:
        path.unlink(missing_ok=True)
        raise
    return asset_read(asset)


@router.get("/profile-extensions/assets")
async def list_assets(db: DbSession, actor: SelfActor):
    rows = await db.scalars(
        select(StoredAsset)
        .where(
            StoredAsset.owner_user_id == actor.id,
            StoredAsset.company_id == actor.company_id,
            StoredAsset.deleted.is_(False),
        )
        .order_by(StoredAsset.created_at.desc())
    )
    return [asset_read(row) for row in rows]


@router.get("/profile-extensions/assets/{asset_id}")
async def download_asset(asset_id: uuid.UUID, db: DbSession, actor: CurrentUser):
    asset = await db.get(StoredAsset, asset_id)
    if asset is None:
        raise missing()
    # A recipient may read an attached snapshot even without roster-management grants.
    addressed = False
    if actor.role == Role.HR and actor.company_id == asset.company_id:
        snapshots = await db.scalars(
            select(CompetencyRequest.source_snapshot).where(
                CompetencyRequest.recipient_id == actor.id,
                CompetencyRequest.sender_id == asset.owner_user_id,
                CompetencyRequest.company_id == actor.company_id,
            )
        )
        addressed = any(
            str(asset.id) in (snapshot.get("credentialUrl") or "")
            or str(asset.id) in (snapshot.get("evidenceUrl") or "")
            for snapshot in snapshots
        )
    if not addressed:
        await target_user(db, actor, asset.owner_user_id)
    if asset.deleted and not addressed:
        raise missing()
    path = Path(os.environ.get("CAREERMATE_UPLOAD_DIR", "/app/uploads")) / str(asset.id)
    if not path.is_file():
        raise missing()
    return FileResponse(
        path,
        media_type=asset.mime_type,
        filename=asset.filename,
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.delete("/profile-extensions/assets/{asset_id}")
async def delete_asset(asset_id: uuid.UUID, db: DbSession, actor: SelfActor):
    asset = await owned_asset(db, actor, asset_id)
    linked_activity = await db.scalar(
        select(ProfileActivityLog.id).where(ProfileActivityLog.evidence_asset_id == asset_id)
    )
    linked_avatar = await db.scalar(
        select(PersonalDetails.user_id).where(PersonalDetails.avatar_asset_id == asset_id)
    )
    if linked_activity or linked_avatar:
        raise HTTPException(409, "Gỡ tệp khỏi hoạt động hoặc ảnh đại diện trước khi xóa")
    asset.deleted = True
    await db.commit()
    return {"id": str(asset.id)}


def activity_read(row):
    return {
        "id": str(row.id),
        "title": row.title,
        "description": row.description,
        "category": row.category,
        "date": row.date,
        "evidenceUrl": row.evidence_url,
        "evidenceAssetId": str(row.evidence_asset_id) if row.evidence_asset_id else None,
        "version": row.version,
    }


@router.get("/activity-logs")
async def list_activities(db: DbSession, actor: CurrentUser, userId: uuid.UUID | None = None):
    target = await target_user(db, actor, userId or actor.id)
    rows = await db.scalars(
        select(ProfileActivityLog)
        .where(
            ProfileActivityLog.owner_user_id == target.id,
            ProfileActivityLog.company_id == target.company_id,
        )
        .order_by(ProfileActivityLog.date.desc(), ProfileActivityLog.created_at.desc())
    )
    return [activity_read(row) for row in rows]


async def set_activity(row, payload, db, actor):
    if payload.evidenceAssetId:
        await owned_asset(db, actor, payload.evidenceAssetId)
    row.title, row.description, row.category, row.date = (
        payload.title,
        payload.description,
        payload.category,
        payload.date,
    )
    row.evidence_url = str(payload.evidenceUrl) if payload.evidenceUrl else None
    row.evidence_asset_id = payload.evidenceAssetId


@router.post("/activity-logs", status_code=201)
async def create_activity(payload: ActivityWrite, db: DbSession, actor: SelfActor):
    row = ProfileActivityLog(owner_user_id=actor.id, company_id=actor.company_id, version=1)
    await set_activity(row, payload, db, actor)
    db.add(row)
    await db.commit()
    return activity_read(row)


async def activity_owned(db, actor, activity_id):
    row = await db.scalar(
        select(ProfileActivityLog)
        .where(
            ProfileActivityLog.id == activity_id,
            ProfileActivityLog.owner_user_id == actor.id,
            ProfileActivityLog.company_id == actor.company_id,
        )
        .with_for_update()
    )
    if row is None:
        raise missing()
    return row


@router.put("/activity-logs/{activity_id}")
async def update_activity(
    activity_id: uuid.UUID, payload: ActivityPatch, db: DbSession, actor: SelfActor
):
    row = await activity_owned(db, actor, activity_id)
    if row.version != payload.expectedVersion:
        raise HTTPException(409, "Hoạt động đã thay đổi. Tải lại trước khi lưu.")
    await set_activity(row, payload, db, actor)
    row.version += 1
    await db.commit()
    return activity_read(row)


@router.delete("/activity-logs/{activity_id}")
async def remove_activity(activity_id: uuid.UUID, db: DbSession, actor: SelfActor):
    row = await activity_owned(db, actor, activity_id)
    await db.delete(row)
    await db.commit()
    return {"id": str(activity_id)}


@router.get("/competency-requests/options")
async def request_options(db: DbSession, actor: SelfActor):
    employments = (
        await db.execute(
            select(Employment, Company)
            .join(Company, Company.id == Employment.company_id)
            .where(Employment.user_id == actor.id, Employment.status == EmploymentStatus.ACTIVE)
        )
    ).all()
    hr = await db.scalars(
        select(User).where(
            User.company_id.in_([employment.company_id for employment, _ in employments]),
            User.role == Role.HR,
            User.is_active.is_(True),
        )
    )
    return {
        "employments": [
            {
                "id": str(e.id),
                "title": e.title,
                "companyId": str(e.company_id),
                "companyName": c.name,
            }
            for e, c in employments
        ],
        "recipients": [
            {"id": str(u.id), "name": u.name, "companyId": str(u.company_id)} for u in hr
        ],
    }


def request_read(row, sender=None):
    return {
        "id": str(row.id),
        "senderId": str(row.sender_id),
        "recipientId": str(row.recipient_id),
        "sourceType": row.source_type,
        "sourceId": str(row.source_id),
        "sourceSnapshot": row.source_snapshot,
        "message": row.message,
        "status": row.status,
        "pointsAwarded": row.points_awarded,
        "reviewNote": row.review_note,
        "createdAt": row.created_at,
        "reviewedAt": row.reviewed_at,
        "sender": {"id": str(sender.id), "name": sender.name, "email": sender.email}
        if sender
        else None,
    }


@router.post("/competency-requests", status_code=201)
async def create_request(payload: RequestCreate, db: DbSession, actor: SelfActor):
    request_hash = hashlib.sha256(
        json.dumps(payload.model_dump(mode="json"), sort_keys=True).encode()
    ).hexdigest()
    await db.execute(select(User.id).where(User.id == actor.id).with_for_update())
    previous = await db.scalar(
        select(CompetencyRequest).where(
            CompetencyRequest.sender_id == actor.id,
            CompetencyRequest.client_request_id == payload.clientRequestId,
        )
    )
    if previous:
        if previous.request_hash != request_hash:
            raise HTTPException(409, "Mã gửi đã dùng với nội dung khác")
        return request_read(previous)
    employment = await db.get(Employment, payload.employmentId)
    recipient = await db.get(User, payload.recipientUserId)
    if (
        not employment
        or employment.user_id != actor.id
        or employment.status != EmploymentStatus.ACTIVE
        or employment.company_id != actor.company_id
    ):
        raise HTTPException(422, "Chọn kỳ làm việc hiện tại của bạn")
    if (
        not recipient
        or not recipient.is_active
        or recipient.role != Role.HR
        or recipient.company_id != employment.company_id
    ):
        raise HTTPException(422, "Chọn HR đang hoạt động cùng công ty")
    if payload.sourceType == "CERTIFICATION":
        certification = await db.get(Certification, payload.sourceId)
        if (
            certification is None
            or certification.user_id != actor.id
            or certification.company_id != actor.company_id
        ):
            raise missing()
        source_id = certification.id
        snapshot = {
            "name": certification.name,
            "issuer": certification.issuer,
            "score": certification.score,
            "issuedAt": certification.issued_at.isoformat() if certification.issued_at else None,
            "credentialUrl": certification.credential_url,
        }
    else:
        award = await db.get(Award, payload.sourceId)
        if award is None or award.user_id != actor.id or award.company_id != actor.company_id:
            raise missing()
        source_id = award.id
        snapshot = {
            "name": award.name,
            "issuer": award.issuer,
            "description": award.description,
            "awardedAt": award.awarded_at.isoformat() if award.awarded_at else None,
            "evidenceUrl": award.evidence_url,
        }
    row = CompetencyRequest(
        sender_id=actor.id,
        recipient_id=recipient.id,
        company_id=actor.company_id,
        employment_id=employment.id,
        source_type=payload.sourceType,
        source_id=source_id,
        source_snapshot=snapshot,
        client_request_id=payload.clientRequestId,
        request_hash=request_hash,
        message=payload.message,
    )
    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Yêu cầu đang được xử lý. Tải lại hộp thư đã gửi.") from None
    return request_read(row)


@router.get("/competency-requests/sent")
async def sent_requests(db: DbSession, actor: SelfActor):
    rows = await db.scalars(
        select(CompetencyRequest)
        .where(
            CompetencyRequest.sender_id == actor.id,
            CompetencyRequest.company_id == actor.company_id,
        )
        .order_by(CompetencyRequest.created_at.desc())
    )
    return [request_read(row) for row in rows]


@router.get("/competency-requests/received")
async def received_requests(
    db: DbSession,
    actor: CurrentUser,
    status: Literal["PENDING", "APPROVED", "REJECTED"] | None = None,
):
    if actor.role != Role.HR:
        raise HTTPException(403, "Chỉ HR được xem yêu cầu gửi trực tiếp cho mình")
    query = (
        select(CompetencyRequest, User)
        .join(User, User.id == CompetencyRequest.sender_id)
        .where(
            CompetencyRequest.recipient_id == actor.id,
            CompetencyRequest.company_id == actor.company_id,
        )
    )
    if status:
        query = query.where(CompetencyRequest.status == status)
    return [
        request_read(row, sender)
        for row, sender in (
            await db.execute(query.order_by(CompetencyRequest.created_at.desc()))
        ).all()
    ]


@router.post("/competency-requests/{request_id}/review")
async def review_request(
    request_id: uuid.UUID, payload: RequestReview, db: DbSession, actor: CurrentUser
):
    if actor.role != Role.HR:
        raise HTTPException(403, "Chỉ HR nhận yêu cầu được duyệt")
    row = await db.scalar(
        select(CompetencyRequest)
        .where(
            CompetencyRequest.id == request_id,
            CompetencyRequest.recipient_id == actor.id,
            CompetencyRequest.company_id == actor.company_id,
        )
        .with_for_update()
    )
    if row is None:
        raise missing()
    points = payload.pointsAwarded if payload.status == "APPROVED" else 0
    if row.status != "PENDING":
        if (row.status, row.points_awarded, row.review_note) == (
            payload.status,
            points,
            payload.reviewNote,
        ):
            return request_read(row)
        raise HTTPException(409, "Yêu cầu đã được duyệt, không thể ghi đè quyết định")
    row.status, row.points_awarded, row.review_note = payload.status, points, payload.reviewNote
    row.reviewed_at = datetime.now(UTC)
    await db.commit()
    return request_read(row)


def employment_read(row):
    return {
        "id": str(row.id),
        "title": row.title,
        "startDate": row.start_date,
        "endDate": row.end_date,
        "status": row.status.value,
        "version": row.version,
    }


@router.get("/profile-extensions/people/{user_id}/employments")
async def list_employments(user_id: uuid.UUID, db: DbSession, actor: CurrentUser):
    await target_user(db, actor, user_id)
    return [
        employment_read(row)
        for row in await db.scalars(
            select(Employment)
            .where(Employment.user_id == user_id)
            .order_by(Employment.start_date.desc())
        )
    ]


@router.post("/profile-extensions/people/{user_id}/employments", status_code=201)
async def add_employment(
    user_id: uuid.UUID, payload: EmploymentWrite, db: DbSession, actor: CurrentUser
):
    target = await writable_target(db, actor, user_id)
    if target.company_id is None or (payload.endDate and payload.endDate < payload.startDate):
        raise HTTPException(422, "Kỳ làm việc cần công ty và ngày hợp lệ")
    await db.execute(select(User.id).where(User.id == user_id).with_for_update())
    active = await db.scalar(
        select(Employment.id).where(
            Employment.user_id == user_id, Employment.status == EmploymentStatus.ACTIVE
        )
    )
    if not payload.endDate and active:
        raise HTTPException(409, "Hãy kết thúc kỳ làm việc hiện tại trước khi tạo kỳ mới")
    row = Employment(
        user_id=user_id,
        company_id=target.company_id,
        title=payload.title,
        start_date=datetime.combine(payload.startDate, datetime.min.time(), UTC),
        end_date=datetime.combine(payload.endDate, datetime.min.time(), UTC)
        if payload.endDate
        else None,
        status=EmploymentStatus.ENDED if payload.endDate else EmploymentStatus.ACTIVE,
    )
    db.add(row)
    await db.commit()
    return employment_read(row)


@router.post("/profile-extensions/people/{user_id}/employments/{employment_id}/end")
async def end_employment(
    user_id: uuid.UUID,
    employment_id: uuid.UUID,
    payload: EmploymentEnd,
    db: DbSession,
    actor: CurrentUser,
):
    target = await writable_target(db, actor, user_id)
    row = await db.scalar(
        select(Employment)
        .where(
            Employment.id == employment_id,
            Employment.user_id == user_id,
            Employment.company_id == target.company_id,
        )
        .with_for_update()
    )
    if row is None:
        raise missing()
    if row.version != payload.expectedVersion or row.status != EmploymentStatus.ACTIVE:
        raise HTTPException(409, "Kỳ làm việc đã thay đổi hoặc đã kết thúc")
    if payload.endDate < row.start_date.date():
        raise HTTPException(422, "Ngày kết thúc không được trước ngày bắt đầu")
    row.end_date = datetime.combine(payload.endDate, datetime.min.time(), UTC)
    row.status = EmploymentStatus.ENDED
    row.version += 1
    await db.commit()
    return employment_read(row)
