/* ==================================================
   Language Lab · Vocabulary
   四语词汇库：本地保存、GitHub 云同步、IPA 音标、
   搜索筛选、A-Z 导航、主题管理与 JSON 备份
   ================================================== */

// ==================================================
// 一、基础配置
// ==================================================

const STORAGE_KEY = "languageLab_vocabulary";
const THEME_STORAGE_KEY = "languageLab_vocabulary_theme";
const SYNC_API = "https://sync.language.pengxingyuan.top";
const SYNC_DELAY = 800;

const LANGUAGES = ["english", "french", "russian"];
const LANGUAGE_TITLES = {
  english: "ENGLISH",
  french: "FRANÇAIS",
  russian: "РУССКИЙ"
};

// ==================================================
// 二、获取页面元素
// ==================================================

const $ = (selector) => document.querySelector(selector);
const byId = (id) => document.getElementById(id);

const addEntryButton = byId("add-entry-button");
const cancelEntryButton = byId("cancel-entry-button");
const entryFormPanel = byId("entry-form-panel");
const vocabularyForm = byId("vocabulary-form");
const vocabularyList = byId("vocabulary-list");
const totalCount = byId("total-count");

const vocabularySearchInput = byId("vocabulary-search-input");
const vocabularySearchLanguage = byId("vocabulary-search-language");
const vocabularySearchStatus = byId("vocabulary-search-status");
const alphabetFilter = byId("vocabulary-alphabet-filter");

const vocabularyThemeToggle = byId("vocabularyThemeToggle");
const vocabularyThemeIcon = byId("vocabularyThemeIcon");
const vocabularyThemeText = byId("vocabularyThemeText");

const expressionContainers = {
  english: byId("english-words"),
  french: byId("french-words"),
  russian: byId("russian-words")
};

const exampleContainers = {
  english: byId("english-examples"),
  french: byId("french-examples"),
  russian: byId("russian-examples")
};

// ==================================================
// 三、页面状态
// ==================================================

let isAuthenticated = false;
let isCloudReady = false;
let hasSyncConflict = false;

let cloudSHA = null;
let syncTimer = null;
let syncPromise = Promise.resolve();
let localRevision = 0;

let vocabularyData = loadVocabulary();
let editingEntryId = null;
let editingEntryReference = null;

let syncStatusElement = null;
let alphabetSelection = "all";

// ==================================================
// 四、通用工具
// ==================================================

function createId() {
  return Date.now().toString() +
    Math.random().toString(36).slice(2, 9);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value) {
  return String(value ?? "").trim();
}

function createTextElement(tagName, className, content) {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  element.textContent = content ?? "";
  return element;
}

// 兼容旧词条，确保表达、例句和音标数据结构可正常读取
function normalizeEntry(entry) {
  const result = {
    ...entry,
    id: entry.id || createId(),
    concept: safeText(entry.concept),
    english: safeArray(entry.english),
    french: safeArray(entry.french),
    russian: safeArray(entry.russian),
    chinese: safeText(entry.chinese),
    notes: safeText(entry.notes),
    examples: {
      english: safeArray(entry.examples?.english),
      french: safeArray(entry.examples?.french),
      russian: safeArray(entry.examples?.russian)
    },
    pronunciations: {
      english: safeArray(entry.pronunciations?.english),
      french: safeArray(entry.pronunciations?.french),
      russian: safeArray(entry.pronunciations?.russian)
    }
  };

  // 音标数组与表达数组保持相同长度
  LANGUAGES.forEach(language => {
    while (result.pronunciations[language].length < result[language].length) {
      result.pronunciations[language].push("");
    }

    result.pronunciations[language] =
      result.pronunciations[language].slice(0, result[language].length);
  });

  return result;
}

// ==================================================
// 五、本地数据管理
// ==================================================

function loadVocabulary() {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);
    const parsedData = savedData ? JSON.parse(savedData) : [];

    return Array.isArray(parsedData)
      ? parsedData.map(normalizeEntry)
      : [];

  } catch (error) {
    console.error("读取本地词汇失败：", error);
    alert("读取本地词汇时发生错误，请检查浏览器数据。");
    return [];
  }
}

function saveLocalVocabulary() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(vocabularyData)
    );

    return true;

  } catch (error) {
    console.error("保存本地词汇失败：", error);
    alert("保存失败，可能是浏览器存储空间不足。");
    return false;
  }
}

function saveVocabulary() {
  if (!saveLocalVocabulary()) {
    return false;
  }

  localRevision++;

  if (isAuthenticated && isCloudReady && !hasSyncConflict) {
    scheduleCloudSync();
  }

  return true;
}

// ==================================================
// 六、云同步状态显示
// ==================================================

function setSyncStatus(message, state = "normal") {
  if (!syncStatusElement) return;

  syncStatusElement.textContent = message;
  syncStatusElement.dataset.state = state;
}

// ==================================================
// 七、创建 GitHub 同步工具栏
// ==================================================

function createSyncControls() {
  const toolbar = document.createElement("div");
  toolbar.className = "vocabulary-sync-toolbar";

  const loginButton = document.createElement("button");
  loginButton.type = "button";
  loginButton.className = "backup-button";
  loginButton.textContent = "↗ Connect GitHub";

  loginButton.addEventListener("click", () => {
    window.location.href = `${SYNC_API}/auth/login`;
  });

  const logoutButton = document.createElement("button");
  logoutButton.type = "button";
  logoutButton.className = "backup-button";
  logoutButton.textContent = "Logout";
  logoutButton.hidden = true;

  logoutButton.addEventListener("click", async () => {
    if (!confirm("确定退出 GitHub 登录吗？\n\n本地词汇不会被删除。")) {
      return;
    }

    try {
      const response = await fetch(`${SYNC_API}/auth/logout`, {
        method: "POST",
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("退出登录失败");
      }

      isAuthenticated = false;
      isCloudReady = false;
      hasSyncConflict = false;

      loginButton.hidden = false;
      logoutButton.hidden = true;

      setSyncStatus("已退出 GitHub · 本地保存正常");

    } catch (error) {
      console.error("退出登录失败：", error);
      alert("退出登录失败，请稍后重试。");
    }
  });

  const syncButton = document.createElement("button");
  syncButton.type = "button";
  syncButton.className = "backup-button";
  syncButton.textContent = "↻ Sync Now";

  syncButton.addEventListener("click", async () => {
    if (!isAuthenticated) {
      alert("请先连接 GitHub。");
      return;
    }

    if (!isCloudReady) {
      alert("云端数据还在读取，请稍后重试。");
      return;
    }

    if (hasSyncConflict) {
      alert("检测到云端版本冲突。请刷新页面，重新读取云端数据后再操作。");
      return;
    }

    await syncVocabulary();
  });

  syncStatusElement = document.createElement("span");
  syncStatusElement.className = "vocabulary-sync-status";
  syncStatusElement.textContent = "正在检查 GitHub...";

  toolbar.append(
    loginButton,
    logoutButton,
    syncButton,
    syncStatusElement
  );

  if (vocabularyList?.parentElement) {
    vocabularyList.parentElement.insertBefore(toolbar, vocabularyList);
  }

  return { loginButton, logoutButton, syncButton };
}

const syncControls = createSyncControls();

// ==================================================
// 八、GitHub API 请求
// ==================================================

async function checkGitHubAuth() {
  const response = await fetch(`${SYNC_API}/auth/status`, {
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error(`登录状态检查失败：${response.status}`);
  }

  return response.json();
}

async function fetchCloudVocabulary() {
  const response = await fetch(`${SYNC_API}/api/vocabulary`, {
    credentials: "include"
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || "读取云端词汇失败");
  }

  return result;
}

async function uploadCloudVocabulary(data, sha) {
  const response = await fetch(`${SYNC_API}/api/vocabulary`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "text/plain;charset=UTF-8"
    },
    body: JSON.stringify({ data, sha })
  });

  const result = await response.json();

  if (response.status === 409 || result.conflict) {
    hasSyncConflict = true;
    setSyncStatus("版本冲突 · 同步已暂停", "error");

    throw new Error("云端文件已被其他设备修改。为避免覆盖数据，已暂停同步。");
  }

  if (!response.ok || !result.success) {
    throw new Error(result.message || "云端保存失败");
  }

  return result;
}

// ==================================================
// 九、自动同步管理
// ==================================================

function scheduleCloudSync() {
  clearTimeout(syncTimer);

  setSyncStatus("等待同步...", "pending");

  syncTimer = setTimeout(() => {
    syncVocabulary();
  }, SYNC_DELAY);
}

function syncVocabulary() {
  syncPromise = syncPromise
    .catch(() => {})
    .then(async () => {
      if (!isAuthenticated || !isCloudReady || hasSyncConflict) {
        return;
      }

      setSyncStatus("正在同步...", "pending");

      try {
        const dataToUpload = JSON.parse(
          JSON.stringify(vocabularyData)
        );

        const revisionAtStart = localRevision;

        const result = await uploadCloudVocabulary(
          dataToUpload,
          cloudSHA
        );

        cloudSHA = result.sha;

        if (localRevision !== revisionAtStart) {
          setSyncStatus("发现新修改，准备再次同步...", "pending");
          scheduleCloudSync();
          return;
        }

        setSyncStatus("已同步到 GitHub", "success");

      } catch (error) {
        console.error("云端同步失败：", error);

        if (!hasSyncConflict) {
          setSyncStatus("同步失败 · 本地数据已保留", "error");
        }
      }
    });

  return syncPromise;
}

// ==================================================
// 十、初始化云端同步
// ==================================================

async function initializeCloudSync() {
  setSyncStatus("正在检查 GitHub...", "pending");

  try {
    const auth = await checkGitHubAuth();

    if (!auth.authenticated) {
      isAuthenticated = false;
      isCloudReady = false;

      syncControls.loginButton.hidden = false;
      syncControls.logoutButton.hidden = true;

      setSyncStatus("未连接 GitHub · 本地保存正常");
      return;
    }

    isAuthenticated = true;

    syncControls.loginButton.hidden = true;
    syncControls.logoutButton.hidden = false;

    setSyncStatus(
      `已连接 GitHub · ${auth.username || ""}`,
      "success"
    );

    const cloudResult = await fetchCloudVocabulary();
    cloudSHA = cloudResult.sha;

    if (!Array.isArray(cloudResult.data)) {
      throw new Error("云端词汇文件格式不正确");
    }

    if (localRevision > 0) {
      hasSyncConflict = true;

      setSyncStatus(
        "本地数据在云端读取期间发生修改，请刷新页面确认",
        "error"
      );

      alert("云端读取期间本地数据发生了变化。为避免数据丢失，暂时停止自动同步。");
      return;
    }

    if (cloudResult.data.length === 0 && vocabularyData.length > 0) {
      const confirmed = confirm(
        `云端词汇库目前为空，但本地有 ${vocabularyData.length} 条词汇。\n\n是否将本地词汇上传到 GitHub？`
      );

      if (confirmed) {
        isCloudReady = true;
        await syncVocabulary();
      } else {
        setSyncStatus("本地与云端数据不同 · 同步暂停", "error");
      }

      return;
    }

    if (
      cloudResult.data.length > 0 &&
      vocabularyData.length > 0 &&
      JSON.stringify(cloudResult.data) !== JSON.stringify(vocabularyData)
    ) {
      const confirmed = confirm(
        `本地有 ${vocabularyData.length} 条词汇，云端有 ${cloudResult.data.length} 条词汇。\n\n确定使用云端数据替换本地数据吗？\n\n选择取消将保留本地数据并暂停同步。`
      );

      if (!confirmed) {
        hasSyncConflict = true;
        setSyncStatus("本地与云端数据不同 · 同步暂停", "error");
        return;
      }
    }

    vocabularyData = cloudResult.data.map(normalizeEntry);

    if (!saveLocalVocabulary()) {
      throw new Error("云端数据已读取，但写入本地缓存失败");
    }

    isCloudReady = true;

    renderVocabulary();

    setSyncStatus(
      `已同步 · ${vocabularyData.length} 条词汇`,
      "success"
    );

  } catch (error) {
    console.error("初始化云端同步失败：", error);

    isCloudReady = false;
    setSyncStatus("云端连接失败 · 本地数据已保留", "error");
  }
}

// ==================================================
// 十一、主题管理
// ==================================================

function setVocabularyTheme(theme) {
  const isLight = theme === "light";

  document.body.classList.toggle("vocabulary-light", isLight);

  if (vocabularyThemeIcon) {
    vocabularyThemeIcon.textContent = isLight ? "☀" : "◐";
  }

  if (vocabularyThemeText) {
    vocabularyThemeText.textContent = isLight
      ? "Light Mode"
      : "Black / Green";
  }

  vocabularyThemeToggle?.setAttribute(
    "aria-pressed",
    String(isLight)
  );

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    console.error("保存主题设置失败：", error);
  }
}

function loadVocabularyTheme() {
  let savedTheme = "dark";

  try {
    savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || "dark";
  } catch (error) {
    console.error("读取主题设置失败：", error);
  }

  if (!["light", "dark"].includes(savedTheme)) {
    savedTheme = "dark";
  }

  setVocabularyTheme(savedTheme);
}

vocabularyThemeToggle?.addEventListener("click", () => {
  const isLight = document.body.classList.contains("vocabulary-light");
  setVocabularyTheme(isLight ? "dark" : "light");
});

// ==================================================
// 十二、JSON 文件备份
// ==================================================

function exportVocabulary() {
  try {
    const backupData = {
      format: "language-lab-vocabulary",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: vocabularyData
    };

    const blob = new Blob(
      [JSON.stringify(backupData, null, 2)],
      { type: "application/json;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `languageLab_vocabulary_${date}.json`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    alert(`备份成功！共导出 ${vocabularyData.length} 条词汇。`);

  } catch (error) {
    console.error("导出词汇失败：", error);
    alert("导出失败，请稍后重试。");
  }
}

function validateVocabularyData(data) {
  if (!Array.isArray(data)) return false;

  return data.every(entry =>
    entry &&
    typeof entry === "object" &&
    !Array.isArray(entry) &&
    typeof entry.concept === "string" &&
    Array.isArray(entry.english) &&
    Array.isArray(entry.french) &&
    Array.isArray(entry.russian) &&
    entry.examples &&
    typeof entry.examples === "object"
  );
}

function importVocabulary(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const parsedData = JSON.parse(reader.result);

      const importedData = Array.isArray(parsedData)
        ? parsedData
        : parsedData?.format === "language-lab-vocabulary" &&
          parsedData?.version === 1
          ? parsedData.data
          : null;

      if (!validateVocabularyData(importedData)) {
        alert("文件格式不正确，或不是有效的 Language Lab 词汇备份。");
        return;
      }

      const confirmed = confirm(
        `即将导入 ${importedData.length} 条词汇。\n\n导入将替换当前本地词汇，并在连接 GitHub 后同步到云端。\n建议先导出当前词汇作为备份。\n\n确定继续吗？`
      );

      if (!confirmed) return;

      const previousData = vocabularyData;

      vocabularyData = importedData.map(normalizeEntry);

      if (!saveVocabulary()) {
        vocabularyData = previousData;
        renderVocabulary();
        return;
      }

      renderVocabulary();

      alert(
        `导入成功！已导入 ${vocabularyData.length} 条词汇。` +
        (isAuthenticated && isCloudReady
          ? "\n云端同步将在稍后自动进行。"
          : "\n当前尚未连接云端，请连接 GitHub 后同步。")
      );

    } catch (error) {
      console.error("导入词汇失败：", error);
      alert("无法读取该文件，请确认它是有效的 JSON 文件。");
    }
  };

  reader.onerror = () => {
    alert("文件读取失败，请重新选择文件。");
  };

  reader.readAsText(file, "UTF-8");
}

// ==================================================
// 十三、创建备份工具栏
// ==================================================

function createBackupControls() {
  const toolbar = document.createElement("div");
  toolbar.className = "vocabulary-backup-actions";

  const exportButton = document.createElement("button");
  exportButton.type = "button";
  exportButton.textContent = "↓ Export Backup";
  exportButton.className = "backup-button";
  exportButton.addEventListener("click", exportVocabulary);

  const importButton = document.createElement("button");
  importButton.type = "button";
  importButton.textContent = "↑ Import Backup";
  importButton.className = "backup-button";

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json,application/json";
  fileInput.hidden = true;

  importButton.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];

    if (file) {
      importVocabulary(file);
    }

    fileInput.value = "";
  });

  const info = document.createElement("div");
  info.className = "backup-info";

  const infoTitle = createTextElement(
    "div",
    "backup-info-title",
    "DATA BACKUP & CLOUD SYNC"
  );

  const infoDescription = createTextElement(
    "p",
    "backup-info-description",
    "词汇数据保存在当前设备，并通过 GitHub 仓库实现多设备同步。Cloudflare Worker 负责安全传输，不使用独立数据库。"
  );

  const infoTip = createTextElement(
    "p",
    "backup-info-tip",
    "Export 下载 JSON 备份；Import 从备份恢复数据。登录 GitHub 后，导入的数据也会自动同步到其他设备。"
  );

  info.append(infoTitle, infoDescription, infoTip);
  toolbar.append(exportButton, importButton, fileInput, info);

  if (vocabularyList?.parentElement) {
    vocabularyList.parentElement.insertBefore(toolbar, vocabularyList);
  }
}

createBackupControls();

// ==================================================
// 十四、表单显示与隐藏
// ==================================================

function openEntryForm() {
  resetForm();

  if (!entryFormPanel) return;

  entryFormPanel.hidden = false;

  entryFormPanel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

addEntryButton?.addEventListener("click", openEntryForm);

cancelEntryButton?.addEventListener("click", () => {
  resetForm();

  if (entryFormPanel) {
    entryFormPanel.hidden = true;
  }
});

// ==================================================
// 十五、动态表达与 IPA 输入
// ==================================================

// 创建单个表达输入项
function createExpressionField(language, value = "", pronunciation = "") {
  const wrapper = document.createElement("div");
  wrapper.className = "dynamic-item";

  const input = document.createElement("input");
  input.type = "text";
  input.name = language;
  input.className = "expression-input";
  input.placeholder = "Add an expression";
  input.value = value;

  // 每个表达都拥有独立的可选 IPA 音标栏
  const details = document.createElement("details");
  details.className = "ipa-field";

  const summary = document.createElement("summary");
  summary.textContent = pronunciation
    ? "IPA · 已填写音标"
    : "Add IPA pronunciation (optional)";

  const ipaInput = document.createElement("input");
  ipaInput.type = "text";
  ipaInput.name = `${language}-ipa`;
  ipaInput.className = "ipa-input";
  ipaInput.placeholder = "/ pronunciation /";
  ipaInput.value = pronunciation;

  details.append(summary, ipaInput);

  details.addEventListener("toggle", () => {
    summary.textContent = details.open
      ? "IPA pronunciation"
      : ipaInput.value.trim()
        ? "IPA · 已填写音标"
        : "Add IPA pronunciation (optional)";
  });

  wrapper.append(input, details);

  return wrapper;
}

// 创建删除按钮
function createRemoveButton(wrapper) {
  const button = document.createElement("button");

  button.type = "button";
  button.className = "remove-field-button";
  button.textContent = "Remove";

  button.addEventListener("click", () => wrapper.remove());

  return button;
}

// 添加表达及其 IPA
function addExpressionField(container, language) {
  if (!container) return;

  const wrapper = createExpressionField(language);
  wrapper.appendChild(createRemoveButton(wrapper));

  container.appendChild(wrapper);
}

// 添加例句
function addExampleField(container) {
  if (!container) return;

  const originalTextarea = container.querySelector("textarea");
  const originalTranslation = container.querySelector(
    'input[name$="-translation"]'
  );

  if (!originalTextarea || !originalTranslation) return;

  const wrapper = document.createElement("div");
  wrapper.className = "example-item";

  const textarea = document.createElement("textarea");
  textarea.name = originalTextarea.name;
  textarea.rows = 2;
  textarea.placeholder = originalTextarea.placeholder;

  const translation = document.createElement("input");
  translation.type = "text";
  translation.name = originalTranslation.name;
  translation.placeholder = originalTranslation.placeholder;

  wrapper.append(
    textarea,
    translation,
    createRemoveButton(wrapper)
  );

  container.appendChild(wrapper);
}

// 绑定所有动态添加按钮
document.querySelectorAll(".add-field-button").forEach(button => {
  button.addEventListener("click", () => {
    const container = byId(button.dataset.target);

    if (!container) return;

    if (button.dataset.type === "example") {
      addExampleField(container);
    } else {
      const language = Object.keys(expressionContainers).find(
        key => expressionContainers[key] === container
      );

      if (language) {
        addExpressionField(container, language);
      }
    }
  });
});

// ==================================================
// 十六、收集表单数据
// ==================================================

function collectExpressions(container) {
  const expressions = [];
  const pronunciations = [];

  if (!container) {
    return { expressions, pronunciations };
  }

  container.querySelectorAll(".dynamic-item").forEach(item => {
    const input = item.querySelector(".expression-input");
    const ipaInput = item.querySelector(".ipa-input");

    const expression = safeText(input?.value);
    const pronunciation = safeText(ipaInput?.value);

    // 只保存有表达内容的项目
    if (expression) {
      expressions.push(expression);
      pronunciations.push(pronunciation);
    }
  });

  return { expressions, pronunciations };
}

function collectExamples(container) {
  if (!container) return [];

  return Array.from(container.querySelectorAll(".example-item"))
    .map(item => ({
      text: safeText(item.querySelector("textarea")?.value),
      translation: safeText(
        item.querySelector('input[name$="-translation"]')?.value
      )
    }))
    .filter(item => item.text || item.translation);
}

function collectFormData() {
  const originalEntry = editingEntryReference;

  const entry = {
    ...(originalEntry || {}),

    id: originalEntry?.id || createId(),

    concept: safeText(byId("concept")?.value),

    chinese: safeText(byId("chinese-meaning")?.value),

    examples: {
      english: collectExamples(exampleContainers.english),
      french: collectExamples(exampleContainers.french),
      russian: collectExamples(exampleContainers.russian)
    },

    notes: safeText(byId("personal-notes")?.value),

    createdAt: originalEntry?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    pronunciations: {}
  };

  LANGUAGES.forEach(language => {
    const result = collectExpressions(expressionContainers[language]);

    entry[language] = result.expressions;
    entry.pronunciations[language] = result.pronunciations;
  });

  return normalizeEntry(entry);
}

// ==================================================
// 十七、重置表单
// ==================================================

function resetForm() {
  editingEntryId = null;
  editingEntryReference = null;

  vocabularyForm?.reset();

  LANGUAGES.forEach(language => {
    const container = expressionContainers[language];
    if (!container) return;

    container.replaceChildren(
      createExpressionField(language)
    );
  });

  LANGUAGES.forEach(language => {
    const container = exampleContainers[language];
    if (!container) return;

    const wrapper = document.createElement("div");
    wrapper.className = "example-item";

    const textarea = document.createElement("textarea");
    textarea.name = `${language}-example`;
    textarea.rows = 2;
    textarea.placeholder = "Write an example...";

    const translation = document.createElement("input");
    translation.type = "text";
    translation.name = `${language}-translation`;
    translation.placeholder = "中文对照（可选）";

    wrapper.append(textarea, translation);
    container.replaceChildren(wrapper);
  });
}

// ==================================================
// 十八、编辑词条
// ==================================================

function fillEditForm(entry) {
  if (!entry) {
    alert("找不到需要编辑的词汇，请刷新页面后重试。");
    return;
  }

  // 旧词条若缺少 ID，先补充分配
  if (!entry.id) {
    entry.id = createId();

    if (!saveVocabulary()) {
      delete entry.id;
      alert("无法保存词条标识，请检查浏览器存储空间后重试。");
      return;
    }
  }

  resetForm();

  const normalized = normalizeEntry(entry);

  byId("concept").value = normalized.concept;
  byId("chinese-meaning").value = normalized.chinese;
  byId("personal-notes").value = normalized.notes;

  LANGUAGES.forEach(language => {
    const container = expressionContainers[language];
    if (!container) return;

    const expressions = normalized[language];
    const pronunciations = normalized.pronunciations[language];

    container.replaceChildren();

    if (expressions.length === 0) {
      container.appendChild(createExpressionField(language));
      return;
    }

    expressions.forEach((expression, index) => {
      const wrapper = createExpressionField(
        language,
        expression,
        pronunciations[index] || ""
      );

      if (index > 0) {
        wrapper.appendChild(createRemoveButton(wrapper));
      }

      container.appendChild(wrapper);
    });
  });

  LANGUAGES.forEach(language => {
    const container = exampleContainers[language];
    if (!container) return;

    const examples = normalized.examples[language];
    const textName = `${language}-example`;
    const translationName = `${language}-translation`;

    container.replaceChildren();

    const list = examples.length ? examples : [
      { text: "", translation: "" }
    ];

    list.forEach((example, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "example-item";

      const textarea = document.createElement("textarea");
      textarea.name = textName;
      textarea.rows = 2;
      textarea.placeholder = "Write an example...";
      textarea.value = example.text || "";

      const translation = document.createElement("input");
      translation.type = "text";
      translation.name = translationName;
      translation.placeholder = "中文对照（可选）";
      translation.value = example.translation || "";

      wrapper.append(textarea, translation);

      if (index > 0) {
        wrapper.appendChild(createRemoveButton(wrapper));
      }

      container.appendChild(wrapper);
    });
  });

  editingEntryId = normalized.id;
  editingEntryReference = entry;

  entryFormPanel.hidden = false;

  entryFormPanel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

// ==================================================
// 十九、保存词汇
// ==================================================

vocabularyForm?.addEventListener("submit", event => {
  event.preventDefault();

  const entry = collectFormData();

  if (!entry.concept) {
    alert("请先填写 Concept / 概念名称。");
    return;
  }

  const previousData = [...vocabularyData];

  if (editingEntryId) {
    const index = vocabularyData.findIndex(
      item => item === editingEntryReference ||
        item.id === editingEntryId
    );

    if (index === -1) {
      alert("找不到需要编辑的词汇，请刷新页面后重试。");
      return;
    }

    vocabularyData[index] = entry;

  } else {
    vocabularyData.unshift(entry);
  }

  if (saveVocabulary()) {
    renderVocabulary();
    resetForm();

    entryFormPanel.hidden = true;

    alert(
      isAuthenticated && isCloudReady
        ? "Vocabulary saved! Cloud sync scheduled."
        : "Vocabulary saved locally. Connect GitHub to sync."
    );

  } else {
    vocabularyData = previousData;
    renderVocabulary();
  }
});

// ==================================================
// 二十、词条卡片展示
// ==================================================

function appendLanguageGrid(card, entry) {
  const grid = document.createElement("div");
  grid.className = "entry-language-grid";

  LANGUAGES.forEach(language => {
    const column = document.createElement("div");
    column.className = "entry-language-column";

    column.appendChild(
      createTextElement("h3", "entry-language", LANGUAGE_TITLES[language])
    );

    const expressionList = document.createElement("div");
    expressionList.className = "entry-expression-list";

    const expressions = safeArray(entry[language]);
    const pronunciations = safeArray(entry.pronunciations?.[language]);

    if (expressions.length === 0) {
      expressionList.appendChild(
        createTextElement("p", "entry-content", "—")
      );
    } else {
      expressions.forEach((expression, index) => {
        const item = document.createElement("div");
        item.className = "entry-expression-item";

        item.appendChild(
          createTextElement("p", "entry-expression-text", expression)
        );

        if (pronunciations[index]) {
          item.appendChild(
            createTextElement(
              "p",
              "entry-expression-ipa",
              pronunciations[index]
            )
          );
        }

        expressionList.appendChild(item);
      });
    }

    column.appendChild(expressionList);
    grid.appendChild(column);
  });

  card.appendChild(grid);
}

function appendExampleSection(card, title, examples) {
  if (!examples || examples.length === 0) return;

  const section = document.createElement("div");
  section.className = "entry-example-section";

  section.appendChild(
    createTextElement("h3", "entry-language", title)
  );

  examples.forEach(example => {
    const item = document.createElement("div");
    item.className = "entry-example";

    item.appendChild(
      createTextElement("p", "example-text", example.text)
    );

    if (example.translation) {
      item.appendChild(
        createTextElement(
          "p",
          "example-translation",
          example.translation
        )
      );
    }

    section.appendChild(item);
  });

  card.appendChild(section);
}

function deleteVocabularyEntry(entry) {
  const confirmed = confirm(`确定删除「${entry.concept}」吗？`);
  if (!confirmed) return;

  const previousData = [...vocabularyData];

  // 优先按对象引用删除，兼容旧词条没有 ID 的情况
  const index = vocabularyData.indexOf(entry);

  if (index === -1) return;

  vocabularyData.splice(index, 1);

  if (saveVocabulary()) {
    renderVocabulary();
  } else {
    vocabularyData = previousData;
    renderVocabulary();
  }
}

function createVocabularyCard(rawEntry) {
  const entry = normalizeEntry(rawEntry);

  const card = document.createElement("article");
  card.className = "vocabulary-card";

  const header = document.createElement("div");
  header.className = "entry-header";

  header.appendChild(
    createTextElement("h2", "entry-concept", entry.concept)
  );

  const date = entry.createdAt
    ? new Date(entry.createdAt).toLocaleDateString("zh-CN")
    : "";

  header.appendChild(
    createTextElement("span", "entry-date", date)
  );

  card.appendChild(header);

  if (entry.chinese) {
    const meaning = document.createElement("div");
    meaning.className = "entry-chinese-meaning";

    meaning.appendChild(
      createTextElement("h3", "entry-language", "中文释义")
    );

    meaning.appendChild(
      createTextElement("p", "entry-meaning-content", entry.chinese)
    );

    card.appendChild(meaning);
  }

  appendLanguageGrid(card, entry);

  const examples = document.createElement("div");
  examples.className = "entry-examples-group";

  appendExampleSection(
    examples,
    "ENGLISH EXAMPLES",
    entry.examples.english
  );

  appendExampleSection(
    examples,
    "FRANÇAIS EXAMPLES",
    entry.examples.french
  );

  appendExampleSection(
    examples,
    "РУССКИЙ EXAMPLES",
    entry.examples.russian
  );

  if (examples.children.length > 0) {
    card.appendChild(examples);
  }

  if (entry.notes) {
    const notes = document.createElement("div");
    notes.className = "entry-notes";

    notes.appendChild(
      createTextElement("h3", "entry-language", "MY NOTES")
    );

    notes.appendChild(
      createTextElement("p", "entry-content", entry.notes)
    );

    card.appendChild(notes);
  }

  const actions = document.createElement("div");
  actions.className = "entry-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "backup-button";
  editButton.textContent = "Edit Entry";

  editButton.addEventListener("click", () => {
    fillEditForm(rawEntry);
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-entry-button";
  deleteButton.textContent = "Delete Entry";

  deleteButton.addEventListener("click", () => {
    deleteVocabularyEntry(rawEntry);
  });

  actions.append(editButton, deleteButton);
  card.appendChild(actions);

  return card;
}

// ==================================================
// 二十一、搜索与语言分类
// ==================================================

// 统一搜索文本：忽略大小写与拉丁字母重音差异
function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();
}

function hasLanguageContent(entry, language) {
  if (language === "all") return true;

  if (LANGUAGES.includes(language)) {
    const expressions = safeArray(entry[language]);
    const examples = safeArray(entry.examples?.[language]);

    return (
      expressions.some(item => safeText(item)) ||
      examples.some(item => safeText(item.text))
    );
  }

  if (language === "chinese") {
    const hasMeaning = safeText(entry.chinese) !== "";

    const hasTranslation = LANGUAGES.some(key =>
      safeArray(entry.examples?.[key]).some(example =>
        safeText(example.translation) !== ""
      )
    );

    return hasMeaning || hasTranslation;
  }

  return true;
}

// 获取指定语言的搜索内容
function getEntrySearchText(entry, language) {
  const contents = [entry.concept];

  if (language === "all") {
    contents.push(entry.chinese, entry.notes);

    LANGUAGES.forEach(key => {
      contents.push(...safeArray(entry[key]));
      contents.push(...safeArray(entry.pronunciations?.[key]));

      safeArray(entry.examples?.[key]).forEach(example => {
        contents.push(example.text, example.translation);
      });
    });

  } else if (LANGUAGES.includes(language)) {
    contents.push(...safeArray(entry[language]));
    contents.push(...safeArray(entry.pronunciations?.[language]));

    safeArray(entry.examples?.[language]).forEach(example => {
      contents.push(example.text);
    });

  } else if (language === "chinese") {
    contents.push(entry.chinese);

    LANGUAGES.forEach(key => {
      safeArray(entry.examples?.[key]).forEach(example => {
        contents.push(example.translation);
      });
    });
  }

  return normalizeSearchText(contents.filter(Boolean).join(" "));
}

// 获取英文表达的首字母
function getEntryInitial(entry) {
  const expressions = safeArray(entry.english);

  for (const expression of expressions) {
    const normalized = safeText(expression)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const match = normalized.match(/[a-z]/i);

    if (match) {
      return match[0].toUpperCase();
    }
  }

  return "";
}

// 当前语言、搜索词和字母共同决定显示结果
function filterVocabulary() {
  const keyword = normalizeSearchText(vocabularySearchInput?.value);
  const language = vocabularySearchLanguage?.value || "all";

  return vocabularyData.filter(rawEntry => {
    const entry = normalizeEntry(rawEntry);

    if (!hasLanguageContent(entry, language)) {
      return false;
    }

    if (keyword) {
      const searchText = getEntrySearchText(entry, language);

      if (!searchText.includes(keyword)) {
        return false;
      }
    }

    if (alphabetSelection !== "all") {
      if (getEntryInitial(entry) !== alphabetSelection) {
        return false;
      }
    }

    return true;
  });
}

// ==================================================
// 二十二、A-Z 首字母导航
// ==================================================

function renderAlphabetFilter() {
  if (!alphabetFilter) return;

  alphabetFilter.replaceChildren();

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = "alphabet-button";
  allButton.dataset.letter = "all";
  allButton.textContent = "全部";
  allButton.setAttribute(
    "aria-pressed",
    String(alphabetSelection === "all")
  );

  if (alphabetSelection === "all") {
    allButton.classList.add("is-active");
  }

  allButton.addEventListener("click", () => {
    alphabetSelection = "all";
    renderAlphabetFilter();
    renderVocabulary();
  });

  alphabetFilter.appendChild(allButton);

  const counts = {};

  vocabularyData.forEach(entry => {
    const letter = getEntryInitial(entry);

    if (letter) {
      counts[letter] = (counts[letter] || 0) + 1;
    }
  });

  letters.forEach(letter => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "alphabet-button";
    button.dataset.letter = letter;
    button.textContent = letter;

    button.disabled = !counts[letter];
    button.title = counts[letter]
      ? `${counts[letter]} 条词汇`
      : "暂无该首字母词汇";

    button.setAttribute(
      "aria-pressed",
      String(alphabetSelection === letter)
    );

    if (alphabetSelection === letter) {
      button.classList.add("is-active");
    }

    button.addEventListener("click", () => {
      if (button.disabled) return;

      alphabetSelection = letter;

      renderAlphabetFilter();
      renderVocabulary();
    });

    alphabetFilter.appendChild(button);
  });
}

// ==================================================
// 二十三、搜索清空按钮
// ==================================================

function createSearchClearButton() {
  const searchWrap = $(".search-input-wrap");

  if (!searchWrap || !vocabularySearchInput) return;

  if (byId("vocabulary-search-clear")) return;

  const button = document.createElement("button");

  button.id = "vocabulary-search-clear";
  button.type = "button";
  button.className = "search-clear-button";
  button.textContent = "×";
  button.setAttribute("aria-label", "清空搜索");
  button.title = "清空搜索";

  button.hidden = true;

  button.addEventListener("click", () => {
    vocabularySearchInput.value = "";
    alphabetSelection = "all";

    renderAlphabetFilter();
    renderVocabulary();

    vocabularySearchInput.focus();
  });

  searchWrap.appendChild(button);
}

function updateSearchClearButton() {
  const button = byId("vocabulary-search-clear");

  if (button && vocabularySearchInput) {
    button.hidden = !vocabularySearchInput.value.trim();
  }
}

// ==================================================
// 二十四、渲染词汇列表
// ==================================================

function renderVocabulary() {
  if (!vocabularyList) return;

  if (totalCount) {
    totalCount.textContent = vocabularyData.length;
  }

  const filteredData = filterVocabulary();

  const hasSearchCondition =
    safeText(vocabularySearchInput?.value) !== "" ||
    (vocabularySearchLanguage?.value || "all") !== "all" ||
    alphabetSelection !== "all";

  if (vocabularySearchStatus) {
    vocabularySearchStatus.textContent = hasSearchCondition
      ? `找到 ${filteredData.length} / ${vocabularyData.length} 条词汇`
      : `共 ${vocabularyData.length} 条词汇`;
  }

  updateSearchClearButton();

  vocabularyList.replaceChildren();

  if (vocabularyData.length === 0) {
    vocabularyList.appendChild(
      createTextElement(
        "p",
        "empty-message",
        "Your collection starts here."
      )
    );

    return;
  }

  if (filteredData.length === 0) {
    vocabularyList.appendChild(
      createTextElement(
        "p",
        "empty-message",
        "没有找到匹配的词汇。试试其他关键词、语言或首字母。"
      )
    );

    return;
  }

  filteredData.forEach(entry => {
    vocabularyList.appendChild(
      createVocabularyCard(entry)
    );
  });
}

// ==================================================
// 二十五、搜索事件
// ==================================================

vocabularySearchInput?.addEventListener("input", () => {
  renderVocabulary();
});

vocabularySearchLanguage?.addEventListener("change", () => {
  // 切换语言分类时保留搜索关键词
  renderVocabulary();
});

// ==================================================
// 二十六、URL 语言分类初始化
// ==================================================

function initializeLanguageFilter() {
  const params = new URLSearchParams(window.location.search);
  const requestedLanguage = params.get("language");

  const supportedLanguages = [
    "all",
    "english",
    "french",
    "russian",
    "chinese"
  ];

  if (
    requestedLanguage &&
    supportedLanguages.includes(requestedLanguage) &&
    vocabularySearchLanguage
  ) {
    vocabularySearchLanguage.value = requestedLanguage;
  }
}

// ==================================================
// 二十七、页面初始化
// ==================================================

loadVocabularyTheme();

initializeLanguageFilter();

createSearchClearButton();

renderAlphabetFilter();

renderVocabulary();

// 检查 GitHub 登录状态并读取云端数据
initializeCloudSync();
// 读取本地缓存数据