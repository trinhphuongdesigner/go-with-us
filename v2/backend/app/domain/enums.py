from enum import StrEnum


class Role(StrEnum):
    SUPER_ADMIN = "SUPER_ADMIN"
    COMPANY_ADMIN = "COMPANY_ADMIN"
    EMPLOYEE = "EMPLOYEE"


class CompanyStatus(StrEnum):
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class EmploymentStatus(StrEnum):
    ACTIVE = "ACTIVE"
    ENDED = "ENDED"


class ProfileImportStatus(StrEnum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    PARSED = "PARSED"
    APPLIED = "APPLIED"
    FAILED = "FAILED"


class AdminPermission(StrEnum):
    COMPANY_READ = "COMPANY_READ"
    COMPANY_WRITE = "COMPANY_WRITE"
    EMPLOYEE_READ = "EMPLOYEE_READ"
    EMPLOYEE_WRITE = "EMPLOYEE_WRITE"
    ASSESSMENT_REVIEW = "ASSESSMENT_REVIEW"
    PASSPORT_APPROVE = "PASSPORT_APPROVE"


class Permission(StrEnum):
    DASHBOARD_READ = "dashboard:read"
    PROFILE_SELF = "profile:self"
    ROADMAP_SELF = "roadmap:self"
    ASSESSMENT_SELF = "assessment:self"
    COMPANY_READ = "company:read"
    COMPANY_MANAGE = "company:manage"
    PEOPLE_READ = "people:read"
    PEOPLE_WRITE = "people:write"
    ASSESSMENT_REVIEW = "assessment:review"
    PASSPORT_APPROVE = "passport:approve"
    PLATFORM_MANAGE = "platform:manage"
