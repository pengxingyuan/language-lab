
/* ==================================================
   Language Lab · Vocabulary
   四语词汇库：动态录入、本地缓存、GitHub 云端同步、
   搜索、主题管理与 JSON 文件备份
   ================================================== */

// ==================================================
// 一、基础配置
// ==================================================

// 本地存储名称
const STORAGE_KEY = "languageLab_vocabulary";
const THEME_STORAGE_KEY = "languageLab_vocabulary_theme";

// Cloudflare Worker API 地址
const SYNC_API = "https://sync.language.pengxingyuan.top";

// 自动同步延迟（毫秒）
const SYNC_DELAY = 800;

// ==================================================
// 二、获取页面元素
// ==================================================

const addEntryButton = document.getElementById("add-entry-button");
const cancelEntryButton = document.getElementById("cancel-entry-button");
const entryFormPanel = document.getElementById("entry-form-panel");
const vocabularyForm = document.getElementById("vocabulary-form");
const vocabularyList = document.getElementById("vocabulary-list");
const totalCount = document.getElementById("total-count");

const vocabularySearchInput = document.getElementById("vocabulary-search-input");
const vocabularySearchLanguage = document.getElementById("vocabulary-search-language");
const vocabularySearchStatus = document.getElementById("vocabulary-search-status");

const vocabularyThemeToggle = document.getElementById("vocabularyThemeToggle");
const vocabularyThemeIcon = document.getElementById("vocabularyThemeIcon");
const vocabularyThemeText = document.getElementById("vocabularyThemeText");

// 三种语言的表达容器
const expressionContainers = {
  english: document.getElementById("english-words"),
  french: document.getElementById("french-words"),
  russian: document.getElementById("russian-words")
};

// 三种语言的例句容器
const exampleContainers = {
  english: document.getElementById("english-examples"),
  french: document.getElementById("french-examples"),
  russian: document.getElementById("russian-examples")
};

// ==================================================
// 三、云端同步状态
// ==================================================

// GitHub 登录状态
let isAuthenticated = false;

// 云端文件是否已经读取
let isCloudReady = false;

// 是否发生版本冲突
let hasSyncConflict = false;

// 当前 GitHub 文件 SHA
let cloudSHA = null;

// 自动同步定时器
let syncTimer = null;

// 同步任务队列
let syncPromise = Promise.resolve();

// 本地数据修改版本
let localRevision = 0;

// 当前词汇数据
let vocabularyData = loadVocabulary();

// 同步状态文字
let syncStatusElement = null;

// ==================================================
// 四、本地数据管理
// ==================================================

// 从浏览器读取词汇
function loadVocabulary() {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);
    const parsedData = savedData ? JSON.parse(savedData) : [];

    return Array.isArray(parsedData) ? parsedData : [];

  } catch (error) {
    console.error("读取本地词汇失败：", error);
    alert("读取本地词汇时发生错误，请检查浏览器数据。");
    return [];
  }
}

// 仅保存到本地，不触发云端同步
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

// 保存本地数据，并安排云端同步
function saveVocabulary() {
  if (!saveLocalVocabulary()) {
    return false;
  }

  localRevision++;

  // 只有登录且完成云端读取后才允许自动同步
  if (isAuthenticated && isCloudReady && !hasSyncConflict) {
    scheduleCloudSync();
  }

  return true;
}

// ==================================================
// 五、同步状态显示
// ==================================================

// 更新同步状态文字
function setSyncStatus(message, state = "normal") {
  if (!syncStatusElement) return;

  syncStatusElement.textContent = message;
  syncStatusElement.dataset.state = state;
}

// ==================================================
// 六、创建同步操作区域
// ==================================================

function createSyncControls() {
  const toolbar = document.createElement("div");
  toolbar.className = "vocabulary-sync-toolbar";

  // 登录按钮
  const loginButton = document.createElement("button");
  loginButton.type = "button";
  loginButton.className = "backup-button";
  loginButton.textContent = "↗ Connect GitHub";

  loginButton.addEventListener("click", () => {
    window.location.href = `${SYNC_API}/auth/login`;
  });

  // 退出登录按钮
  const logoutButton = document.createElement("button");
  logoutButton.type = "button";
  logoutButton.className = "backup-button";
  logoutButton.textContent = "Logout";
  logoutButton.hidden = true;

  logoutButton.addEventListener("click", async () => {
    const confirmed = confirm(
      "确定退出 GitHub 登录吗？\n\n本地词汇不会被删除。"
    );

    if (!confirmed) return;

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

      setSyncStatus("已退出 GitHub · 本地保存正常", "normal");

    } catch (error) {
      console.error("退出登录失败：", error);
      alert("退出登录失败，请稍后重试。");
    }
  });

  // 手动同步按钮
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
      alert(
        "检测到云端版本冲突。\n\n" +
        "为了保护数据，自动同步已经暂停。\n" +
        "请刷新页面，重新读取云端数据后再操作。"
      );
      return;
    }

    await syncVocabulary();
  });

  // 同步状态
  syncStatusElement = document.createElement("span");
  syncStatusElement.className = "vocabulary-sync-status";
  syncStatusElement.textContent = "正在检查 GitHub...";

  toolbar.append(
    loginButton,
    logoutButton,
    syncButton,
    syncStatusElement
  );

  // 将同步区域插入页面
  vocabularyList.parentElement.insertBefore(
    toolbar,
    vocabularyList
  );

  return {
    loginButton,
    logoutButton,
    syncButton
  };
}

const syncControls = createSyncControls();

// ==================================================
// 七、GitHub API 请求
// ==================================================

// 检查 GitHub 登录状态
async function checkGitHubAuth() {
  const response = await fetch(`${SYNC_API}/auth/status`, {
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error(`登录状态检查失败：${response.status}`);
  }

  return await response.json();
}

// 读取云端词汇
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

// 上传词汇到 GitHub
async function uploadCloudVocabulary(data, sha) {
  const response = await fetch(`${SYNC_API}/api/vocabulary`, {
    method: "POST",
    credentials: "include",

    // 使用 text/plain，避免不必要的 CORS 预检请求
    headers: {
      "Content-Type": "text/plain;charset=UTF-8"
    },

    body: JSON.stringify({
      data,
      sha
    })
  });

  const result = await response.json();

  // 版本冲突
  if (response.status === 409 || result.conflict) {
    hasSyncConflict = true;

    setSyncStatus("版本冲突 · 同步已暂停", "error");

    throw new Error(
      "云端文件已被其他设备修改。为避免覆盖数据，已暂停同步。"
    );
  }

  if (!response.ok || !result.success) {
    throw new Error(result.message || "云端保存失败");
  }

  return result;
}

// ==================================================
// 八、自动同步管理
// ==================================================

// 安排自动同步
function scheduleCloudSync() {
  clearTimeout(syncTimer);

  setSyncStatus("等待同步...", "pending");

  syncTimer = setTimeout(() => {
    syncVocabulary();
  }, SYNC_DELAY);
}

// 执行云端同步
function syncVocabulary() {
  // 所有写入按顺序执行，避免同时提交旧 SHA
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

        // 上传期间如果本地又发生修改，再安排一次同步
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
// 九、初始化云端同步
// ==================================================

async function initializeCloudSync() {
  setSyncStatus("正在检查 GitHub...", "pending");

  try {
    // 第一步：检查登录状态
    const auth = await checkGitHubAuth();

    if (!auth.authenticated) {
      isAuthenticated = false;
      isCloudReady = false;

      syncControls.loginButton.hidden = false;
      syncControls.logoutButton.hidden = true;

      setSyncStatus("未连接 GitHub · 本地保存正常", "normal");
      return;
    }

    isAuthenticated = true;

    syncControls.loginButton.hidden = true;
    syncControls.logoutButton.hidden = false;

    setSyncStatus(
      `已连接 GitHub · ${auth.username || ""}`,
      "success"
    );

    // 第二步：读取云端词汇
    const cloudResult = await fetchCloudVocabulary();

    cloudSHA = cloudResult.sha;

    if (!Array.isArray(cloudResult.data)) {
      throw new Error("云端词汇文件格式不正确");
    }

    // 读取过程中若本地发生过修改，不直接覆盖
    const localChangedDuringLoad = localRevision > 0;

    if (localChangedDuringLoad) {
      hasSyncConflict = true;

      setSyncStatus(
        "本地数据在云端读取期间发生修改，请刷新页面确认",
        "error"
      );

      alert(
        "云端读取期间本地数据发生了变化。\n\n" +
        "为避免数据丢失，暂时停止自动同步。"
      );

      return;
    }

    // 云端为空，但本地存在数据
    if (cloudResult.data.length === 0 && vocabularyData.length > 0) {
      const confirmed = confirm(
        `云端词汇库目前为空，但本地有 ${vocabularyData.length} 条词汇。\n\n` +
        "是否将本地词汇上传到 GitHub？"
      );

      if (confirmed) {
        isCloudReady = true;
        await syncVocabulary();
      } else {
        setSyncStatus("本地与云端数据不同 · 同步暂停", "error");
      }

      return;
    }

    // 云端和本地都有数据，且内容不同
    if (
      cloudResult.data.length > 0 &&
      vocabularyData.length > 0 &&
      JSON.stringify(cloudResult.data) !== JSON.stringify(vocabularyData)
    ) {
      const confirmed = confirm(
        `本地有 ${vocabularyData.length} 条词汇，` +
        `云端有 ${cloudResult.data.length} 条词汇。\n\n` +
        "确定使用云端数据替换本地数据吗？\n\n" +
        "选择取消将保留本地数据并暂停同步。"
      );

      if (!confirmed) {
        hasSyncConflict = true;

        setSyncStatus("本地与云端数据不同 · 同步暂停", "error");
        return;
      }
    }

    // 云端数据作为正式数据源
    vocabularyData = cloudResult.data;

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
// 十、主题管理
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

  if (vocabularyThemeToggle) {
    vocabularyThemeToggle.setAttribute(
      "aria-pressed",
      String(isLight)
    );
  }

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

  if (savedTheme !== "light" && savedTheme !== "dark") {
    savedTheme = "dark";
  }

  setVocabularyTheme(savedTheme);
}

if (vocabularyThemeToggle) {
  vocabularyThemeToggle.addEventListener("click", () => {
    const isLight = document.body.classList.contains("vocabulary-light");

    setVocabularyTheme(isLight ? "dark" : "light");
  });
}

// ==================================================
// 十一、JSON 文件备份
// ==================================================

// 导出 JSON 备份
function exportVocabulary() {
  try {
    const backupData = {
      format: "language-lab-vocabulary",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: vocabularyData
    };

    const jsonText = JSON.stringify(backupData, null, 2);

    const blob = new Blob(
      [jsonText],
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

    // 延迟释放下载地址
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    alert(`备份成功！共导出 ${vocabularyData.length} 条词汇。`);

  } catch (error) {
    console.error("导出词汇失败：", error);
    alert("导出失败，请稍后重试。");
  }
}

// 检查导入的数据格式
function validateVocabularyData(data) {
  if (!Array.isArray(data)) return false;

  return data.every((entry) => {
    return (
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
  });
}

// 导入 JSON 文件
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
        `即将导入 ${importedData.length} 条词汇。\n\n` +
        "导入将替换当前本地词汇，并在连接 GitHub 后同步到云端。\n" +
        "建议先导出当前词汇作为备份。\n\n" +
        "确定继续吗？"
      );

      if (!confirmed) return;

      const previousData = vocabularyData;

      vocabularyData = importedData;

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

// 创建备份按钮

/* ==================================================
   词汇库备份工具栏
   提供 JSON 导入、导出及云端同步机制说明
   ================================================== */

function createBackupControls() {
  // 创建备份工具栏
  const toolbar = document.createElement("div");
  toolbar.className = "vocabulary-backup-actions";

  // ---------- 01. 导出按钮 ----------
  const exportButton = document.createElement("button");
  exportButton.type = "button";
  exportButton.textContent = "↓ Export Backup";
  exportButton.className = "backup-button";
  exportButton.addEventListener("click", exportVocabulary);

  // ---------- 02. 导入按钮 ----------
  const importButton = document.createElement("button");
  importButton.type = "button";
  importButton.textContent = "↑ Import Backup";
  importButton.className = "backup-button";

  // 隐藏文件选择框
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json,application/json";
  fileInput.hidden = true;

  // 点击导入按钮，打开文件选择窗口
  importButton.addEventListener("click", () => {
    fileInput.click();
  });

  // 选择 JSON 文件后执行导入
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];

    if (file) {
      importVocabulary(file);
    }

    // 清空选择状态，允许重复选择同一个文件
    fileInput.value = "";
  });

  // ---------- 03. 运行机制说明 ----------
  const info = document.createElement("div");
  info.className = "backup-info";

  const infoTitle = document.createElement("div");
  infoTitle.className = "backup-info-title";
  infoTitle.textContent = "DATA BACKUP & CLOUD SYNC";

  const infoDescription = document.createElement("p");
  infoDescription.className = "backup-info-description";
  infoDescription.textContent =
    "词汇数据保存在当前设备，并通过 GitHub 仓库实现多设备同步。Cloudflare Worker 负责安全传输，不使用独立数据库。";

  const infoTip = document.createElement("p");
  infoTip.className = "backup-info-tip";
  infoTip.textContent =
    "Export 下载 JSON 备份；Import 从备份恢复数据。登录 GitHub 后，导入的数据也会自动同步到其他设备。";

  info.append(infoTitle, infoDescription, infoTip);

  // ---------- 04. 组合工具栏 ----------
  toolbar.append(
    exportButton,
    importButton,
    fileInput,
    info
  );

  // 将工具栏插入词汇列表之前
  vocabularyList.parentElement.insertBefore(
    toolbar,
    vocabularyList
  );
}

createBackupControls();

// ==================================================
// 十二、页面显示与隐藏
// ==================================================

if (addEntryButton) {
  addEntryButton.addEventListener("click", () => {
    entryFormPanel.hidden = false;

    entryFormPanel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
}

if (cancelEntryButton) {
  cancelEntryButton.addEventListener("click", () => {
    entryFormPanel.hidden = true;
  });
}

// ==================================================
// 十三、动态添加表达与例句
// ==================================================

function createRemoveButton(wrapper) {
  const button = document.createElement("button");

  button.type = "button";
  button.className = "remove-field-button";
  button.textContent = "Remove";

  button.addEventListener("click", () => {
    wrapper.remove();
  });

  return button;
}

function addExpressionField(container) {
  const wrapper = document.createElement("div");
  wrapper.className = "dynamic-item";

  const originalInput = container.querySelector("input");

  const input = document.createElement("input");
  input.type = "text";
  input.name = originalInput.name;
  input.placeholder = "Add another expression";

  wrapper.append(input, createRemoveButton(wrapper));

  container.appendChild(wrapper);
}

function addExampleField(container) {
  const wrapper = document.createElement("div");
  wrapper.className = "example-item";

  const originalTextarea = container.querySelector("textarea");
  const originalTranslation = container.querySelector(
    'input[name$="-translation"]'
  );

  const textarea = document.createElement("textarea");
  textarea.name = originalTextarea.name;
  textarea.rows = 2;
  textarea.placeholder = "Write another example...";

  const translation = document.createElement("input");
  translation.type = "text";
  translation.name = originalTranslation.name;
  translation.placeholder = "中文对照（可选）";

  wrapper.append(
    textarea,
    translation,
    createRemoveButton(wrapper)
  );

  container.appendChild(wrapper);
}

document.querySelectorAll(".add-field-button").forEach((button) => {
  button.addEventListener("click", () => {
    const container = document.getElementById(button.dataset.target);

    if (!container) return;

    if (button.dataset.type === "example") {
      addExampleField(container);
    } else {
      addExpressionField(container);
    }
  });
});

// ==================================================
// 十四、收集表单数据
// ==================================================

function collectExpressions(container) {
  return Array.from(container.querySelectorAll("input"))
    .map(input => input.value.trim())
    .filter(value => value !== "");
}

function collectExamples(container) {
  return Array.from(container.querySelectorAll(".example-item"))
    .map(item => ({
      text: item.querySelector("textarea").value.trim(),
      translation: item.querySelector(
        'input[name$="-translation"]'
      ).value.trim()
    }))
    .filter(item => item.text !== "" || item.translation !== "");
}

function collectFormData() {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 8),

    concept: document.getElementById("concept").value.trim(),

    english: collectExpressions(expressionContainers.english),
    french: collectExpressions(expressionContainers.french),
    russian: collectExpressions(expressionContainers.russian),

    chinese: document.getElementById("chinese-meaning").value.trim(),

    examples: {
      english: collectExamples(exampleContainers.english),
      french: collectExamples(exampleContainers.french),
      russian: collectExamples(exampleContainers.russian)
    },

    notes: document.getElementById("personal-notes").value.trim(),

    createdAt: new Date().toISOString()
  };
}

// ==================================================
// 十五、保存词汇
// ==================================================

vocabularyForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const entry = collectFormData();

  if (!entry.concept) {
    alert("请先填写 Concept / 概念名称。");
    return;
  }

  vocabularyData.unshift(entry);

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
    vocabularyData.shift();
  }
});

// ==================================================
// 十六、重置录入表单
// ==================================================

function createInitialExample(textName, translationName, placeholder) {
  const wrapper = document.createElement("div");
  wrapper.className = "example-item";

  const textarea = document.createElement("textarea");
  textarea.name = textName;
  textarea.rows = 2;
  textarea.placeholder = placeholder;

  const translation = document.createElement("input");
  translation.type = "text";
  translation.name = translationName;
  translation.placeholder = "中文对照（可选）";

  wrapper.append(textarea, translation);

  return wrapper;
}

function resetForm() {
  vocabularyForm.reset();

  Object.values(expressionContainers).forEach((container) => {
    const inputName = container.querySelector("input").name;

    const input = document.createElement("input");
    input.type = "text";
    input.name = inputName;
    input.placeholder = "Expression";

    container.replaceChildren(input);
  });

  Object.values(exampleContainers).forEach((container) => {
    const textareaName = container.querySelector("textarea").name;

    const translationName = container.querySelector(
      'input[name$="-translation"]'
    ).name;

    const example = createInitialExample(
      textareaName,
      translationName,
      "Write an example..."
    );

    container.replaceChildren(example);
  });
}

// ==================================================
// 十七、通用展示元素
// ==================================================

function createTextElement(tagName, className, content) {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  element.textContent = content ?? "";

  return element;
}

// ==================================================
// 十八、词汇卡片展示
// ==================================================

function appendLanguageGrid(card, entry) {
  const grid = document.createElement("div");
  grid.className = "entry-language-grid";

  const languages = [
    { key: "english", title: "ENGLISH" },
    { key: "french", title: "FRANÇAIS" },
    { key: "russian", title: "РУССКИЙ" }
  ];

  languages.forEach((language) => {
    const column = document.createElement("div");
    column.className = "entry-language-column";

    column.appendChild(
      createTextElement("h3", "entry-language", language.title)
    );

    const expressions = entry[language.key] || [];

    column.appendChild(
      createTextElement(
        "p",
        "entry-content",
        expressions.length ? expressions.join(" · ") : "—"
      )
    );

    grid.appendChild(column);
  });

  card.appendChild(grid);
}

function appendExampleSection(card, title, examples) {
  if (!examples || examples.length === 0) return;

  const section = document.createElement("div");
  section.className = "entry-section entry-example-section";

  section.appendChild(
    createTextElement("h3", "entry-language", title)
  );

  examples.forEach((example) => {
    const item = document.createElement("div");
    item.className = "entry-example";

    item.appendChild(
      createTextElement("p", "example-text", example.text)
    );

    if (example.translation) {
      item.appendChild(
        createTextElement("p", "example-translation", example.translation)
      );
    }

    section.appendChild(item);
  });

  card.appendChild(section);
}

function createVocabularyCard(entry) {
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

  // 中文释义
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

  // 三语表达
  appendLanguageGrid(card, entry);

  // 三语例句
  const examples = document.createElement("div");
  examples.className = "entry-examples-group";

  appendExampleSection(
    examples,
    "ENGLISH EXAMPLES",
    entry.examples?.english
  );

  appendExampleSection(
    examples,
    "FRANÇAIS EXAMPLES",
    entry.examples?.french
  );

  appendExampleSection(
    examples,
    "РУССКИЙ EXAMPLES",
    entry.examples?.russian
  );

  if (examples.children.length > 0) {
    card.appendChild(examples);
  }

  // 个人备注
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

  // 删除按钮
  const actions = document.createElement("div");
  actions.className = "entry-actions";

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-entry-button";
  deleteButton.textContent = "Delete Entry";

  deleteButton.addEventListener("click", () => {
    const confirmed = confirm(`确定删除「${entry.concept}」吗？`);

    if (!confirmed) return;

    const previousData = vocabularyData;

    vocabularyData = vocabularyData.filter(
      item => item.id !== entry.id
    );

    if (saveVocabulary()) {
      renderVocabulary();
    } else {
      vocabularyData = previousData;
    }
  });

  actions.appendChild(deleteButton);
  card.appendChild(actions);

  return card;
}

// ==================================================
// 十九、词汇搜索
// ==================================================

function normalizeSearchText(value) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

function getEntrySearchText(entry, language) {
  const contents = [entry.concept];

  if (language === "all") {
    contents.push(
      entry.chinese,
      entry.notes,
      ...(entry.english || []),
      ...(entry.french || []),
      ...(entry.russian || [])
    );

    ["english", "french", "russian"].forEach((key) => {
      (entry.examples?.[key] || []).forEach((example) => {
        contents.push(example.text, example.translation);
      });
    });
  }

  else if (language === "english") {
    contents.push(...(entry.english || []));

    (entry.examples?.english || []).forEach((example) => {
      contents.push(example.text);
    });
  }

  else if (language === "french") {
    contents.push(...(entry.french || []));

    (entry.examples?.french || []).forEach((example) => {
      contents.push(example.text);
    });
  }

  else if (language === "russian") {
    contents.push(...(entry.russian || []));

    (entry.examples?.russian || []).forEach((example) => {
      contents.push(example.text);
    });
  }

  else if (language === "chinese") {
    contents.push(entry.chinese);

    ["english", "french", "russian"].forEach((key) => {
      (entry.examples?.[key] || []).forEach((example) => {
        contents.push(example.translation);
      });
    });
  }

  return normalizeSearchText(
    contents.filter(Boolean).join(" ")
  );
}

function filterVocabulary() {
  const keyword = normalizeSearchText(vocabularySearchInput?.value);
  const language = vocabularySearchLanguage?.value || "all";

  return vocabularyData.filter((entry) => {
    if (!keyword) return true;

    return getEntrySearchText(entry, language).includes(keyword);
  });
}

// ==================================================
// 二十、渲染词汇列表
// ==================================================

function renderVocabulary() {
  totalCount.textContent = vocabularyData.length;

  const filteredData = filterVocabulary();

  if (vocabularySearchStatus) {
    const hasSearchCondition =
      normalizeSearchText(vocabularySearchInput?.value) !== "" ||
      (vocabularySearchLanguage?.value || "all") !== "all";

    vocabularySearchStatus.textContent = hasSearchCondition
      ? `找到 ${filteredData.length} / ${vocabularyData.length} 条词汇`
      : `共 ${vocabularyData.length} 条词汇`;
  }

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
        "No matching vocabulary found."
      )
    );

    return;
  }

  filteredData.forEach((entry) => {
    vocabularyList.appendChild(
      createVocabularyCard(entry)
    );
  });
}

// 搜索输入
if (vocabularySearchInput) {
  vocabularySearchInput.addEventListener("input", renderVocabulary);
}

// 切换搜索语言
if (vocabularySearchLanguage) {
  vocabularySearchLanguage.addEventListener("change", renderVocabulary);
}

// ==================================================
// 二十一、页面初始化
// ==================================================

// 恢复上次选择的主题
loadVocabularyTheme();

// 先展示本地缓存
renderVocabulary();

// 检查 GitHub 登录状态并读取云端数据
initializeCloudSync();
