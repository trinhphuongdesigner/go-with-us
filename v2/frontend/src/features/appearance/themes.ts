export type ThemePresetId = "bright-milo" | "bright-sky" | "bright-violet";

export interface ThemeColors {
  primary: string;
  primaryStrong: string;
  primarySubtle: string;
  background: string;
  surface: string;
  ink: string;
  muted: string;
  border: string;
}

export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  shortDescription: string;
  description: string;
  badge?: string;
  isDefault?: boolean;
  colors: ThemeColors;
}

export const DEFAULT_THEME_ID: ThemePresetId = "bright-milo";

export const ALLOWLISTED_THEME_IDS: readonly ThemePresetId[] = [
  "bright-milo",
  "bright-sky",
  "bright-violet",
] as const;

export function isThemePresetId(value: unknown): value is ThemePresetId {
  return typeof value === "string" && (ALLOWLISTED_THEME_IDS as readonly string[]).includes(value);
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "bright-milo",
    name: "Bright Milo",
    shortDescription: "Xanh ngọc năng động",
    description: "Sắc xanh ngọc tươi sáng, hiện đại, kết hợp hài hòa với nhận diện thương hiệu Milo.",
    badge: "Mặc định",
    isDefault: true,
    colors: {
      primary: "#247A66",
      primaryStrong: "#1C6756",
      primarySubtle: "#DBF4E7",
      background: "#F6FAF8",
      surface: "#ffffff",
      ink: "#18312A",
      muted: "#52645D",
      border: "#DCE9E3",
    },
  },
  {
    id: "bright-sky",
    name: "Bright Sky",
    shortDescription: "Bầu trời khoáng đạt",
    description: "Sắc lam quang đãng, độ tương phản cao, mang lại cảm giác tập trung và chuyên nghiệp.",
    colors: {
      primary: "#1A6CB0",
      primaryStrong: "#13548A",
      primarySubtle: "#DCEEFA",
      background: "#F4F8FC",
      surface: "#ffffff",
      ink: "#122438",
      muted: "#4E657D",
      border: "#D4E3F0",
    },
  },
  {
    id: "bright-violet",
    name: "Bright Violet",
    shortDescription: "Hoa cà thanh lịch",
    description: "Tông tím sáng tạo và tinh tế, tăng tính thẩm mỹ nhưng vẫn bảo đảm độ tương phản chuẩn mực.",
    colors: {
      primary: "#6B47B8",
      primaryStrong: "#543398",
      primarySubtle: "#EFE9FC",
      background: "#FAF7FD",
      surface: "#ffffff",
      ink: "#241838",
      muted: "#625675",
      border: "#E7DEF3",
    },
  },
];

export function getThemePreset(id: ThemePresetId): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0];
}
