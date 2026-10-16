export type Locale = 'zh-CN' | 'en-US';
export type PaperSize = 'A4' | 'Letter';
export type MarginPreset = 'narrow' | 'normal' | 'wide';

export type ListKey =
  | 'education'
  | 'experience'
  | 'projects'
  | 'skills'
  | 'certificates'
  | 'customSections';

/** 有标题、且标题可以被用户改写的分区（不含右侧联系方式等） */
export type SectionTitleKey = 'summary' | 'education' | 'experience' | 'projects' | 'skills' | 'certificates';

/** 可排序的分区：具有标题的分区，加上自定义模块 */
export type SectionKey = SectionTitleKey | 'customSections';

export type ProfileKey =
  | 'name'
  | 'title'
  | 'phone'
  | 'email'
  | 'website'
  | 'linkedin'
  | 'location'
  | 'workAuth'
  | 'summary';

export type PhotoAlign = 'left' | 'center' | 'right';

/** avatar 为 data URL 格式的个人照片，avatarAlign 缺省时为 left */
export type Profile = Record<ProfileKey, string> & { avatar?: string; avatarAlign?: PhotoAlign };

export type ListItem = { id: string } & Record<string, string>;

/** 每个分区标题的可改写文案，按语言分别保存 */
export type SectionTitles = Partial<Record<Locale, Partial<Record<SectionTitleKey, string>>>>;

export interface ResumeMeta {
  templateId: string;
  locale: Locale;
  paperSize: PaperSize;
  margin: MarginPreset;
  customCss: string;
  customHtml: string | null;
  /** 主题色（#rrggbb），空字符串表示使用模板默认颜色 */
  themeColor: string;
  /** 日期显示格式，中文与英文的可选项不同 */
  dateFormat: DateFormat;
  /** 分区标题的改写，未设置时使用内置文案 */
  sectionTitles: SectionTitles;
  /** 分区显示顺序 */
  sectionOrder: SectionKey[];
  /** 正文字号缩放（0.8 ~ 1.2），用于整体调大/调小或压缩到一页 */
  fontScale: number;
  updatedAt: string;
}

export interface ResumeDoc {
  version: '1.0';
  meta: ResumeMeta;
  profile: Profile;
  education: ListItem[];
  experience: ListItem[];
  projects: ListItem[];
  skills: ListItem[];
  certificates: ListItem[];
  customSections: ListItem[];
}

export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  html: string;
  css: string;
  /** 联系方式之间真实存在的分隔符（会代入 DOM 文本，便于复制与机器解析） */
  contactSep: string;
}

export type DateFormat = 'ym' | 'my' | 'mmy' | 'cn';
