import type { AppLocale } from "./types";

/** Dot-path message keys used with `t()`. */
export type MessageKey =
  | "locale.sectionTitle"
  | "locale.sectionDesc"
  | "locale.applyAll"
  | "locale.applied"
  | "profile.title"
  | "profile.subtitle"
  | "profile.account"
  | "profile.loading"
  | "profile.signOut"
  | "profile.signIn"
  | "profile.notSignedIn"
  | "profile.textbooks"
  | "profile.appearance"
  | "sidebar.workspace"
  | "sidebar.study"
  | "sidebar.learningMode"
  | "sidebar.grades"
  | "sidebar.autoGrader"
  | "sidebar.profile"
  | "sidebar.learningProgress"
  | "sidebar.history"
  | "sidebar.signIn"
  | "sidebar.signOut"
  | "sidebar.signInHistory"
  | "sidebar.guest"
  | "note.whatYouLearn"
  | "note.keyVocab"
  | "note.formulas"
  | "note.exampleAsk"
  | "note.collapse"
  | "note.seeInBook"
  | "note.askFollowUp"
  | "note.noCurated"
  | "note.askAi"
  | "note.inTheBook"
  | "chat.placeholder"
  | "chat.newQuestion"
  | "ask.whatIs"
  | "ask.followUp"
  | "ask.replyLang";

const EN: Record<MessageKey, string> = {
  "locale.sectionTitle": "System language",
  "locale.sectionDesc":
    "Applies to navigation, profile, study notes, chat placeholders, and AI reply language across the whole app.",
  "locale.applyAll": "Apply to entire app",
  "locale.applied": "System language updated.",
  "profile.title": "My profile",
  "profile.subtitle": "Account, textbooks, appearance, and language.",
  "profile.account": "Account",
  "profile.loading": "Loading…",
  "profile.signOut": "Sign out",
  "profile.signIn": "Sign in",
  "profile.notSignedIn": "You are not signed in. Sign in to save chat history and sync learning progress.",
  "profile.textbooks": "Textbooks and outlines",
  "profile.appearance": "Appearance",
  "sidebar.workspace": "Workspace",
  "sidebar.study": "Study",
  "sidebar.learningMode": "Learning Mode",
  "sidebar.grades": "Grades",
  "sidebar.autoGrader": "Auto Grader",
  "sidebar.profile": "My profile",
  "sidebar.learningProgress": "Learning Progress",
  "sidebar.history": "History",
  "sidebar.signIn": "Sign in",
  "sidebar.signOut": "Sign out",
  "sidebar.signInHistory": "Sign in to keep your chat history.",
  "sidebar.guest": "Guest",
  "note.whatYouLearn": "What you'll learn",
  "note.keyVocab": "Key vocabulary",
  "note.formulas": "Important formulas",
  "note.exampleAsk": "Example / Ask",
  "note.collapse": "Collapse",
  "note.seeInBook": "See in textbook ↗",
  "note.askFollowUp": "Ask AI to follow up",
  "note.noCurated": "No curated example for this term in the book yet.",
  "note.askAi": 'Ask AI: What is "{term}"?',
  "note.inTheBook": "In the book ·",
  "chat.placeholder": "Ask a math question…",
  "chat.newQuestion": "I already fully understand — Start a new question",
  "ask.whatIs": 'What is "{term}"? Explain using this section and give a short example.',
  "ask.followUp": "Please give another example or help me understand more deeply.",
  "ask.replyLang": "",
};

const ZH: Record<MessageKey, string> = {
  "locale.sectionTitle": "系统语言",
  "locale.sectionDesc": "一键切换全站界面、学习笔记、聊天提示与 AI 回复语言。",
  "locale.applyAll": "应用到整个应用",
  "locale.applied": "系统语言已更新。",
  "profile.title": "我的资料",
  "profile.subtitle": "账号、教材、外观与语言设置。",
  "profile.account": "账号",
  "profile.loading": "加载中…",
  "profile.signOut": "退出登录",
  "profile.signIn": "登录",
  "profile.notSignedIn": "您尚未登录。登录后可保存聊天记录并同步学习进度。",
  "profile.textbooks": "教材与大纲",
  "profile.appearance": "外观",
  "sidebar.workspace": "工作区",
  "sidebar.study": "学习",
  "sidebar.learningMode": "学习模式",
  "sidebar.grades": "成绩",
  "sidebar.autoGrader": "自动批改",
  "sidebar.profile": "我的资料",
  "sidebar.learningProgress": "学习进度",
  "sidebar.history": "对话历史",
  "sidebar.signIn": "登录",
  "sidebar.signOut": "退出",
  "sidebar.signInHistory": "登录以保存对话历史。",
  "sidebar.guest": "访客",
  "note.whatYouLearn": "本节要点",
  "note.keyVocab": "关键词汇",
  "note.formulas": "重要公式",
  "note.exampleAsk": "示例 / 提问",
  "note.collapse": "收起",
  "note.seeInBook": "在书中查看 ↗",
  "note.askFollowUp": "继续追问 AI",
  "note.noCurated": "本书暂未策展此词条的示例。",
  "note.askAi": "向 AI 提问：什么是「{term}」？",
  "note.inTheBook": "书中此处 ·",
  "chat.placeholder": "输入数学问题…",
  "chat.newQuestion": "我已完全理解 — 开始新问题",
  "ask.whatIs": "什么是「{term}」？请用本节内容解释并给一个简短示例。",
  "ask.followUp": "请再举一个例子或帮我加深理解。",
  "ask.replyLang": "请用简体中文回答。",
};

const ES: Record<MessageKey, string> = {
  "locale.sectionTitle": "Idioma del sistema",
  "locale.sectionDesc":
    "Aplica a la navegación, notas de estudio, chat y respuestas de la IA en toda la aplicación.",
  "locale.applyAll": "Aplicar a toda la app",
  "locale.applied": "Idioma del sistema actualizado.",
  "profile.title": "Mi perfil",
  "profile.subtitle": "Cuenta, libros, apariencia e idioma.",
  "profile.account": "Cuenta",
  "profile.loading": "Cargando…",
  "profile.signOut": "Cerrar sesión",
  "profile.signIn": "Iniciar sesión",
  "profile.notSignedIn": "No has iniciado sesión. Inicia sesión para guardar el historial y sincronizar el progreso.",
  "profile.textbooks": "Libros y esquemas",
  "profile.appearance": "Apariencia",
  "sidebar.workspace": "Espacio de trabajo",
  "sidebar.study": "Estudio",
  "sidebar.learningMode": "Modo de aprendizaje",
  "sidebar.grades": "Calificaciones",
  "sidebar.autoGrader": "Corrector automático",
  "sidebar.profile": "Mi perfil",
  "sidebar.learningProgress": "Progreso de aprendizaje",
  "sidebar.history": "Historial",
  "sidebar.signIn": "Iniciar sesión",
  "sidebar.signOut": "Cerrar sesión",
  "sidebar.signInHistory": "Inicia sesión para guardar tu historial de chat.",
  "sidebar.guest": "Invitado",
  "note.whatYouLearn": "Qué aprenderás",
  "note.keyVocab": "Vocabulario clave",
  "note.formulas": "Fórmulas importantes",
  "note.exampleAsk": "Ejemplo / Preguntar",
  "note.collapse": "Contraer",
  "note.seeInBook": "Ver en el libro ↗",
  "note.askFollowUp": "Pedir más a la IA",
  "note.noCurated": "Aún no hay un ejemplo curado en el libro para este término.",
  "note.askAi": 'Preguntar a la IA: ¿Qué es "{term}"?',
  "note.inTheBook": "En el libro ·",
  "chat.placeholder": "Haz una pregunta de matemáticas…",
  "chat.newQuestion": "Ya lo entiendo — Empezar una pregunta nueva",
  "ask.whatIs": '¿Qué es "{term}"? Explica con esta sección y da un ejemplo breve.',
  "ask.followUp": "Da otro ejemplo o ayúdame a entender mejor.",
  "ask.replyLang": "Responde en español.",
};

export const MESSAGES: Record<AppLocale, Record<MessageKey, string>> = {
  en: EN,
  zh: ZH,
  es: ES,
};

export function formatMessage(template: string, vars?: Record<string, string>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}

export function chatLanguageSuffix(locale: AppLocale): string {
  const hint = MESSAGES[locale]["ask.replyLang"];
  return hint ? `\n\n${hint}` : "";
}
