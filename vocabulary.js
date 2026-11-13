/* =========================================================
   Language Lab · Vocabulary

   四语词汇库：
   1. 本地数据保存
   2. Cloudflare Worker / GitHub 云同步
   3. JSON 文件导入与导出
   4. 动态表达与 IPA 音标
   5. 多语言例句
   6. 词条新增、编辑、删除
   7. 搜索与语言筛选
   8. A-Z 首字母导航
   9. 深色与浅色主题

   数据结构保持兼容：
   concept、chinese、english、french、russian、
   pronunciations、examples、notes、date、id
   ========================================================= */


/* =========================================================
   一、基础配置
   ========================================================= */

// 本地词汇数据存储名称
const STORAGE_KEY = "languageLab_vocabulary";

// 主题设置存储名称
const THEME_STORAGE_KEY = "languageLab_vocabulary_theme";

// Cloudflare Worker API 地址
const SYNC_API = "https://sync.language.pengxingyuan.top";

// 自动同步延迟，避免连续输入时频繁请求
const SYNC_DELAY = 800;


/* =========================================================
   二、语言配置
   ========================================================= */

// 词汇库支持的语言
const LANGUAGES = ["english", "french", "russian"];

// 语言显示名称
const LANGUAGE_LABELS = {
  english: "English",
  french: "Français",
  russian: "Русский"
};

// 语言对应的表达容器
const WORD_CONTAINER_IDS = {
  english: "english-words",
  french: "french-words",
  russian: "russian-words"
};

// 语言对应的例句容器
const EXAMPLE_CONTAINER_IDS = {
  english: "english-examples",
  french: "french-examples",
  russian: "russian-examples"
};

// 语言对应的例句字段
const EXAMPLE_FIELD_NAMES = {
  english: {
    text: "english-example",
    translation: "english-translation"
  },
  french: {
    text: "french-example",
    translation: "french-translation"
  },
  russian: {
    text: "russian-example",
    translation: "russian-translation"
  }
};


/* =========================================================
   三、页面元素
   ========================================================= */

// 表单元素
const vocabularyForm = document.getElementById("vocabulary-form");
const entryFormPanel = document.getElementById("entry-form-panel");

const addEntryButton = document.getElementById("add-entry-button");
const cancelEntryButton = document.getElementById("cancel-entry-button");

const conceptInput = document.getElementById("concept");
const chineseInput = document.getElementById("chinese-meaning");
const notesInput = document.getElementById("personal-notes");

// 列表元素
const vocabularyList = document.getElementById("vocabulary-list");
const totalCount = document.getElementById("total-count");
const searchStatus = document.getElementById("vocabulary-search-status");

// 搜索元素
const searchInput = document.getElementById("vocabulary-search-input");
const languageFilter = document.getElementById("vocabulary-search-language");

// 首字母导航
const alphabetFilter = document.getElementById("vocabulary-alphabet-filter");

// 主题按钮
const themeToggle = document.getElementById("vocabularyThemeToggle");
const themeIcon = document.getElementById("vocabularyThemeIcon");
const themeText = document.getElementById("vocabularyThemeText");


/* =========================================================
   四、运行状态
   ========================================================= */

// 当前词汇数据
let vocabularyData = [];

// 当前正在编辑的词条 ID
let editingEntryId = null;

// 当前首字母筛选条件
let activeAlphabet = "all";

// 云端数据版本号
let cloudRevision = null;

// 自动同步定时器
let syncTimer = null;

// 同步任务队列，避免并发写入
let syncQueue = Promise.resolve();

// 当前同步状态
let isSyncing = false;

// 是否正在初始化云同步
let cloudInitialized = false;

// 是否已经登录 GitHub
let isCloudAuthenticated = false;

// 防止云端初始化覆盖本地未同步数据
let hasLocalData = false;


/* =========================================================
   五、通用工具函数
   ========================================================= */

// 生成唯一 ID
function generateId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `entry-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}


// 安全转换为字符串
function safeString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}


// HTML 转义，防止用户输入被当作 HTML 执行
function escapeHTML(value) {
  return safeString(value).replace(/[&<>"']/g, character => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character];
  });
}


// 获取当前日期
function getCurrentDate() {
  return new Date().toISOString().slice(0, 10);
}


// 安全解析 JSON
function safeJSONParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error("JSON 解析失败：", error);
    return fallback;
  }
}


// 生成防重复 ID
function ensureEntryIds(data) {
  const usedIds = new Set();

  return data.map(entry => {
    let id = safeString(entry.id).trim();

    if (!id || usedIds.has(id)) {
      id = generateId();
    }

    usedIds.add(id);

    return {
      ...entry,
      id
    };
  });
}


/* =========================================================
   六、数据标准化与旧数据兼容
   ========================================================= */

// 标准化表达数组
function normalizeExpressionArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(item => safeString(item).trim())
    .filter(Boolean);
}


// 标准化 IPA 数据
function normalizePronunciations(value) {
  const result = {
    english: [],
    french: [],
    russian: []
  };

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return result;
  }

  LANGUAGES.forEach(language => {
    const source = value[language];

    if (Array.isArray(source)) {
      result[language] = source.map(item => safeString(item));
    }
  });

  return result;
}


// 标准化例句数据
function normalizeExamples(value) {
  const result = {
    english: [],
    french: [],
    russian: []
  };

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return result;
  }

  LANGUAGES.forEach(language => {
    const source = value[language];

    if (!Array.isArray(source)) {
      return;
    }

    result[language] = source
      .filter(item => item && typeof item === "object")
      .map(item => ({
        text: safeString(item.text),
        translation: safeString(item.translation)
      }))
      .filter(item => item.text.trim() || item.translation.trim());
  });

  return result;
}


// 标准化单条词汇
function normalizeEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }

  return {
    ...entry,

    id: safeString(entry.id).trim() || generateId(),

    concept: safeString(entry.concept),
    chinese: safeString(entry.chinese),

    english: normalizeExpressionArray(entry.english),
    french: normalizeExpressionArray(entry.french),
    russian: normalizeExpressionArray(entry.russian),

    pronunciations: normalizePronunciations(entry.pronunciations),

    examples: normalizeExamples(entry.examples),

    notes: safeString(entry.notes),

    date: safeString(entry.date) || getCurrentDate()
  };
}


// 验证并标准化词汇数组
function validateVocabularyData(data) {
  if (!Array.isArray(data)) {
    return null;
  }

  const normalized = data
    .map(normalizeEntry)
    .filter(Boolean);

  return ensureEntryIds(normalized);
}


/* =========================================================
   七、本地数据存储
   ========================================================= */

// 从 localStorage 读取词汇
function loadLocalVocabulary() {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);

    if (!savedData) {
      vocabularyData = [];
      hasLocalData = false;
      return;
    }

    const parsedData = safeJSONParse(savedData, []);

    vocabularyData = validateVocabularyData(parsedData) || [];

    hasLocalData = vocabularyData.length > 0;

  } catch (error) {
    console.error("读取本地词汇失败：", error);

    vocabularyData = [];
    hasLocalData = false;
  }
}


// 保存词汇到 localStorage
function saveLocalVocabulary() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(vocabularyData)
    );

    hasLocalData = vocabularyData.length > 0;

    return true;

  } catch (error) {
    console.error("本地保存失败：", error);

    alert("本地保存失败，请检查浏览器存储空间。");

    return false;
  }
}


// 数据发生变化后的统一保存入口
function saveVocabulary() {
  if (!saveLocalVocabulary()) {
    return false;
  }

  renderVocabulary();

  scheduleCloudSync();

  return true;
}


/* =========================================================
   八、动态表达输入框
   ========================================================= */

// 为表达输入项创建 IPA 折叠栏
function createIPAField(language, index, value = "") {
  const details = document.createElement("details");
  details.className = "ipa-field";

  const summary = document.createElement("summary");
  summary.textContent = "添加 IPA 音标（选填）";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "ipa-input";
  input.placeholder = "例如：/ˈæp.əl/";
  input.value = safeString(value);

  input.dataset.language = language;
  input.dataset.index = String(index);

  details.append(summary, input);

  return details;
}


// 创建一个表达输入项
function createExpressionItem(language, value = "", ipa = "") {
  const wrapper = document.createElement("div");
  wrapper.className = "dynamic-item";

  const input = document.createElement("input");
  input.type = "text";
  input.name = language;
  input.className = "expression-input";
  input.placeholder = "Add an expression";
  input.value = safeString(value);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "remove-field-button";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => {
    wrapper.remove();
  });

  const ipaField = createIPAField(language, 0, ipa);

  wrapper.append(input, ipaField, removeButton);

  return wrapper;
}


// 初始化默认表达输入框的 IPA 折叠栏
function initializeExpressionFields() {
  LANGUAGES.forEach(language => {
    const container = document.getElementById(
      WORD_CONTAINER_IDS[language]
    );

    if (!container) {
      return;
    }

    const items = container.querySelectorAll(".dynamic-item");

    items.forEach((item, index) => {
      if (item.querySelector(".ipa-field")) {
        return;
      }

      const ipaField = createIPAField(language, index);

      const input = item.querySelector(".expression-input");

      if (input) {
        input.insertAdjacentElement("afterend", ipaField);
      }
    });
  });
}


// 添加一个表达输入框
function addExpressionField(language, value = "", ipa = "") {
  const container = document.getElementById(
    WORD_CONTAINER_IDS[language]
  );

  if (!container) {
    return;
  }

  const item = createExpressionItem(language, value, ipa);

  container.appendChild(item);
}


// 收集表达与 IPA
function collectExpressions(language) {
  const container = document.getElementById(
    WORD_CONTAINER_IDS[language]
  );

  if (!container) {
    return {
      expressions: [],
      pronunciations: []
    };
  }

  const expressions = [];
  const pronunciations = [];

  container.querySelectorAll(".dynamic-item").forEach(item => {
    const input = item.querySelector(".expression-input");

    if (!input) {
      return;
    }

    const expression = input.value.trim();

    const ipaInput = item.querySelector(".ipa-input");
    const ipa = ipaInput ? ipaInput.value.trim() : "";

    if (expression) {
      expressions.push(expression);
      pronunciations.push(ipa);
    }
  });

  return {
    expressions,
    pronunciations
  };
}


/* =========================================================
   九、动态例句输入框
   ========================================================= */

// 创建例句输入项
function createExampleItem(language, text = "", translation = "") {
  const wrapper = document.createElement("div");
  wrapper.className = "example-item";

  const textarea = document.createElement("textarea");
  textarea.name = EXAMPLE_FIELD_NAMES[language].text;
  textarea.rows = 2;
  textarea.placeholder = "Write an example...";
  textarea.value = safeString(text);

  const translationInput = document.createElement("input");
  translationInput.name = EXAMPLE_FIELD_NAMES[language].translation;
  translationInput.type = "text";
  translationInput.placeholder = "中文对照（可选）";
  translationInput.value = safeString(translation);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "remove-field-button";
  removeButton.textContent = "Remove";

  removeButton.addEventListener("click", () => {
    wrapper.remove();
  });

  wrapper.append(
    textarea,
    translationInput,
    removeButton
  );

  return wrapper;
}


// 添加例句输入框
function addExampleField(language, text = "", translation = "") {
  const container = document.getElementById(
    EXAMPLE_CONTAINER_IDS[language]
  );

  if (!container) {
    return;
  }

  container.appendChild(
    createExampleItem(language, text, translation)
  );
}


// 收集例句
function collectExamples() {
  const examples = {
    english: [],
    french: [],
    russian: []
  };

  LANGUAGES.forEach(language => {
    const container = document.getElementById(
      EXAMPLE_CONTAINER_IDS[language]
    );

    if (!container) {
      return;
    }

    container.querySelectorAll(".example-item").forEach(item => {
      const textarea = item.querySelector("textarea");
      const translationInput = item.querySelector("input");

      const text = textarea ? textarea.value.trim() : "";

      const translation = translationInput
        ? translationInput.value.trim()
        : "";

      if (text || translation) {
        examples[language].push({
          text,
          translation
        });
      }
    });
  });

  return examples;
}


/* =========================================================
   十、表单重置
   ========================================================= */

// 重置表达输入框
function resetExpressionContainers() {
  LANGUAGES.forEach(language => {
    const container = document.getElementById(
      WORD_CONTAINER_IDS[language]
    );

    if (!container) {
      return;
    }

    container.replaceChildren();

    const item = createExpressionItem(language);

    container.appendChild(item);
  });
}


// 重置例句输入框
function resetExampleContainers() {
  LANGUAGES.forEach(language => {
    const container = document.getElementById(
      EXAMPLE_CONTAINER_IDS[language]
    );

    if (!container) {
      return;
    }

    container.replaceChildren();

    container.appendChild(
      createExampleItem(language)
    );
  });
}


// 重置整个表单
function resetForm() {
  if (vocabularyForm) {
    vocabularyForm.reset();
  }

  resetExpressionContainers();
  resetExampleContainers();

  editingEntryId = null;

  const submitButton = vocabularyForm
    ? vocabularyForm.querySelector('button[type="submit"]')
    : null;

  if (submitButton) {
    submitButton.textContent = "Save Vocabulary";
  }
}


// 打开新增表单
function openNewEntryForm() {
  resetForm();

  if (entryFormPanel) {
    entryFormPanel.hidden = false;

    entryFormPanel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  if (conceptInput) {
    setTimeout(() => conceptInput.focus(), 250);
  }
}


// 关闭表单
function closeEntryForm() {
  resetForm();

  if (entryFormPanel) {
    entryFormPanel.hidden = true;
  }
}


/* =========================================================
   十一、新增与编辑词条
   ========================================================= */

// 从表单收集词条数据
function collectFormData() {
  const entry = {
    id: editingEntryId || generateId(),

    concept: conceptInput ? conceptInput.value.trim() : "",

    chinese: chineseInput ? chineseInput.value.trim() : "",

    english: [],
    french: [],
    russian: [],

    pronunciations: {
      english: [],
      french: [],
      russian: []
    },

    examples: collectExamples(),

    notes: notesInput ? notesInput.value.trim() : "",

    date: getCurrentDate()
  };

  LANGUAGES.forEach(language => {
    const result = collectExpressions(language);

    entry[language] = result.expressions;

    entry.pronunciations[language] = result.pronunciations;
  });

  return entry;
}


// 保存词条
function handleFormSubmit(event) {
  event.preventDefault();

  if (!conceptInput || !conceptInput.value.trim()) {
    alert("请填写概念名称。");
    return;
  }

  const entry = normalizeEntry(collectFormData());

  if (!entry) {
    return;
  }

  if (editingEntryId) {
    const index = vocabularyData.findIndex(
      item => item.id === editingEntryId
    );

    if (index !== -1) {
      vocabularyData[index] = {
        ...vocabularyData[index],
        ...entry
      };
    }

  } else {
    vocabularyData.push(entry);
  }

  if (saveVocabulary()) {
    closeEntryForm();
  }
}


// 填充编辑表单
function fillEditForm(entryId) {
  const entry = vocabularyData.find(
    item => item.id === entryId
  );

  if (!entry) {
    return;
  }

  resetForm();

  editingEntryId = entry.id;

  if (conceptInput) {
    conceptInput.value = entry.concept || "";
  }

  if (chineseInput) {
    chineseInput.value = entry.chinese || "";
  }

  if (notesInput) {
    notesInput.value = entry.notes || "";
  }

  LANGUAGES.forEach(language => {
    const container = document.getElementById(
      WORD_CONTAINER_IDS[language]
    );

    if (!container) {
      return;
    }

    container.replaceChildren();

    const expressions = Array.isArray(entry[language])
      ? entry[language]
      : [];

    const pronunciations = entry.pronunciations &&
      Array.isArray(entry.pronunciations[language])
      ? entry.pronunciations[language]
      : [];

    if (expressions.length === 0) {
      container.appendChild(
        createExpressionItem(language)
      );

      return;
    }

    expressions.forEach((expression, index) => {
      container.appendChild(
        createExpressionItem(
          language,
          expression,
          pronunciations[index] || ""
        )
      );
    });
  });

  LANGUAGES.forEach(language => {
    const container = document.getElementById(
      EXAMPLE_CONTAINER_IDS[language]
    );

    if (!container) {
      return;
    }

    container.replaceChildren();

    const examples = entry.examples &&
      Array.isArray(entry.examples[language])
      ? entry.examples[language]
      : [];

    if (examples.length === 0) {
      container.appendChild(
        createExampleItem(language)
      );

      return;
    }

    examples.forEach(example => {
      container.appendChild(
        createExampleItem(
          language,
          example.text,
          example.translation
        )
      );
    });
  });

  const submitButton = vocabularyForm
    ? vocabularyForm.querySelector('button[type="submit"]')
    : null;

  if (submitButton) {
    submitButton.textContent = "Update Vocabulary";
  }

  if (entryFormPanel) {
    entryFormPanel.hidden = false;

    entryFormPanel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}


/* =========================================================
   十二、删除词条
   ========================================================= */

// 删除指定词条
function deleteEntry(entryId) {
  const entry = vocabularyData.find(
    item => item.id === entryId
  );

  if (!entry) {
    return;
  }

  const confirmed = confirm(
    `确定要删除词条「${entry.concept}」吗？此操作无法撤销。`
  );

  if (!confirmed) {
    return;
  }

  vocabularyData = vocabularyData.filter(
    item => item.id !== entryId
  );

  if (editingEntryId === entryId) {
    closeEntryForm();
  }

  saveVocabulary();
}


/* =========================================================
   十三、词条搜索
   ========================================================= */

// 获取词条的全部可搜索内容
function getEntrySearchText(entry) {
  const parts = [
    entry.concept,
    entry.chinese,
    entry.notes
  ];

  LANGUAGES.forEach(language => {
    parts.push(...(entry[language] || []));

    const pronunciations = entry.pronunciations &&
      Array.isArray(entry.pronunciations[language])
      ? entry.pronunciations[language]
      : [];

    parts.push(...pronunciations);

    const examples = entry.examples &&
      Array.isArray(entry.examples[language])
      ? entry.examples[language]
      : [];

    examples.forEach(example => {
      parts.push(example.text);
      parts.push(example.translation);
    });
  });

  return parts.join(" ").toLowerCase();
}


// 判断词条是否符合语言筛选
function matchesLanguage(entry, language) {
  if (language === "all") {
    return true;
  }

  if (language === "chinese") {
    return Boolean(
      safeString(entry.chinese).trim() ||
      safeString(entry.concept).trim()
    );
  }

  return Array.isArray(entry[language]) &&
    entry[language].length > 0;
}


// 获取词条用于 A-Z 排序的英文主表达
function getEntryAlphabetSource(entry) {
  const english = Array.isArray(entry.english)
    ? entry.english
    : [];

  const firstEnglish = english.find(
    item => safeString(item).trim()
  );

  return firstEnglish || entry.concept || "";
}


// 获取首字母
function getEntryInitial(entry) {
  const source = safeString(
    getEntryAlphabetSource(entry)
  ).trim();

  if (!source) {
    return "#";
  }

  // 法语重音字符先进行标准化，例如 é 转换为 e
  const normalized = source
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const firstCharacter = normalized.charAt(0).toUpperCase();

  return /^[A-Z]$/.test(firstCharacter)
    ? firstCharacter
    : "#";
}


// 获取当前筛选结果
function getFilteredVocabulary() {
  const keyword = searchInput
    ? searchInput.value.trim().toLowerCase()
    : "";

  const language = languageFilter
    ? languageFilter.value
    : "all";

  return vocabularyData.filter(entry => {
    if (!matchesLanguage(entry, language)) {
      return false;
    }

    if (keyword) {
      const searchText = getEntrySearchText(entry);

      if (!searchText.includes(keyword)) {
        return false;
      }
    }

    if (activeAlphabet !== "all") {
      if (getEntryInitial(entry) !== activeAlphabet) {
        return false;
      }
    }

    return true;
  });
}


/* =========================================================
   十四、词条排序
   ========================================================= */

// 按照英文主表达首字母排序
function sortVocabulary(data) {
  return [...data].sort((a, b) => {
    const nameA = getEntryAlphabetSource(a)
      .toLocaleLowerCase();

    const nameB = getEntryAlphabetSource(b)
      .toLocaleLowerCase();

    const result = nameA.localeCompare(
      nameB,
      "en",
      { sensitivity: "base" }
    );

    if (result !== 0) {
      return result;
    }

    return safeString(a.concept).localeCompare(
      safeString(b.concept),
      "zh-CN"
    );
  });
}


/* =========================================================
   十五、A-Z 首字母导航
   ========================================================= */

// 更新字母导航
function renderAlphabetFilter() {
  if (!alphabetFilter) {
    return;
  }

  const availableLetters = new Set(
    vocabularyData.map(getEntryInitial)
  );

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  alphabetFilter.replaceChildren();

  // 全部按钮
  const allButton = document.createElement("button");

  allButton.type = "button";
  allButton.className = "alphabet-button";
  allButton.textContent = "全部";
  allButton.dataset.letter = "all";

  if (activeAlphabet === "all") {
    allButton.classList.add("is-active");
  }

  allButton.setAttribute(
    "aria-pressed",
    String(activeAlphabet === "all")
  );

  alphabetFilter.appendChild(allButton);

  // A-Z 按钮
  letters.forEach(letter => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "alphabet-button";
    button.textContent = letter;
    button.dataset.letter = letter;

    const available = availableLetters.has(letter);

    button.disabled = !available;

    if (activeAlphabet === letter) {
      button.classList.add("is-active");
    }

    button.setAttribute(
      "aria-pressed",
      String(activeAlphabet === letter)
    );

    alphabetFilter.appendChild(button);
  });

  // 其他字符归入 #
  const otherButton = document.createElement("button");

  otherButton.type = "button";
  otherButton.className = "alphabet-button";
  otherButton.textContent = "#";
  otherButton.dataset.letter = "#";

  otherButton.disabled = !availableLetters.has("#");

  if (activeAlphabet === "#") {
    otherButton.classList.add("is-active");
  }

  otherButton.setAttribute(
    "aria-pressed",
    String(activeAlphabet === "#")
  );

  alphabetFilter.appendChild(otherButton);
}


// 处理首字母点击
function handleAlphabetClick(event) {
  const button = event.target.closest(".alphabet-button");

  if (!button || button.disabled) {
    return;
  }

  activeAlphabet = button.dataset.letter || "all";

  renderAlphabetFilter();
  renderVocabulary();
}


/* =========================================================
   十六、词条卡片渲染
   ========================================================= */

// 创建词条卡片
function createVocabularyCard(entry) {
  const card = document.createElement("article");

  card.className = "vocabulary-card";

  const dateText = escapeHTML(entry.date || "");

  let html = `
    <div class="entry-header">
      <h3 class="entry-concept">${escapeHTML(entry.concept)}</h3>
      <span class="entry-date">${dateText}</span>
    </div>
  `;

  // 中文释义
  if (entry.chinese) {
    html += `
      <div class="entry-chinese-meaning">
        <p class="entry-language">CHINESE MEANING</p>
        <p class="entry-meaning-content">${escapeHTML(entry.chinese)}</p>
      </div>
    `;
  }

  // 三种语言的表达
  html += `<div class="entry-language-grid">`;

  LANGUAGES.forEach(language => {
    const expressions = Array.isArray(entry[language])
      ? entry[language]
      : [];

    const pronunciations = entry.pronunciations &&
      Array.isArray(entry.pronunciations[language])
      ? entry.pronunciations[language]
      : [];

    html += `
      <section class="entry-language-column">
        <p class="entry-language">${LANGUAGE_LABELS[language]}</p>
        <div class="entry-expression-list">
    `;

    if (expressions.length === 0) {
      html += `
        <p class="entry-content">—</p>
      `;
    } else {
      expressions.forEach((expression, index) => {
        const ipa = pronunciations[index] || "";

        html += `
          <div class="entry-expression-item">
            <p class="entry-expression-text">
              ${escapeHTML(expression)}
            </p>
            ${
              ipa
                ? `<p class="entry-expression-ipa">${escapeHTML(ipa)}</p>`
                : ""
            }
          </div>
        `;
      });
    }

    html += `
        </div>
      </section>
    `;
  });

  html += `</div>`;

  // 三种语言的例句
  const hasExamples = LANGUAGES.some(language => {
    return entry.examples &&
      Array.isArray(entry.examples[language]) &&
      entry.examples[language].length > 0;
  });

  if (hasExamples) {
    html += `<div class="entry-examples-group">`;

    LANGUAGES.forEach(language => {
      const examples = entry.examples &&
        Array.isArray(entry.examples[language])
        ? entry.examples[language]
        : [];

      if (examples.length === 0) {
        return;
      }

      html += `
        <section class="entry-example-section">
          <p class="entry-language">${LANGUAGE_LABELS[language]} · EXAMPLES</p>
      `;

      examples.forEach(example => {
        html += `
          <div class="entry-example">
            <p class="example-text">${escapeHTML(example.text)}</p>

            ${
              example.translation
                ? `<p class="example-translation">${escapeHTML(example.translation)}</p>`
                : ""
            }
          </div>
        `;
      });

      html += `</section>`;
    });

    html += `</div>`;
  }

  // 个人备注
  if (entry.notes) {
    html += `
      <div class="entry-notes">
        <p class="entry-language">PERSONAL NOTES</p>
        <p class="entry-content">${escapeHTML(entry.notes)}</p>
      </div>
    `;
  }

  // 操作按钮
  html += `
    <div class="entry-actions">
      <button
        class="secondary-button edit-entry-button"
        type="button"
        data-id="${escapeHTML(entry.id)}"
      >
        Edit
      </button>

      <button
        class="delete-entry-button"
        type="button"
        data-id="${escapeHTML(entry.id)}"
      >
        Delete
      </button>
    </div>
  `;

  card.innerHTML = html;

  return card;
}


/* =========================================================
   十七、渲染词汇列表
   ========================================================= */

// 渲染词汇列表
function renderVocabulary() {
  if (!vocabularyList) {
    return;
  }

  if (totalCount) {
    totalCount.textContent = String(vocabularyData.length);
  }

  renderAlphabetFilter();

  const filteredData = sortVocabulary(
    getFilteredVocabulary()
  );

  if (searchStatus) {
    searchStatus.textContent =
      `显示 ${filteredData.length} / ${vocabularyData.length} 条词汇`;
  }

  vocabularyList.replaceChildren();

  if (filteredData.length === 0) {
    const emptyMessage = document.createElement("p");

    emptyMessage.className = "empty-message";

    emptyMessage.textContent = vocabularyData.length === 0
      ? "还没有词汇，点击 Add Vocabulary 开始建立你的词汇库。"
      : "没有找到符合条件的词汇，试试其他关键词或筛选条件。";

    vocabularyList.appendChild(emptyMessage);

    return;
  }

  filteredData.forEach(entry => {
    vocabularyList.appendChild(
      createVocabularyCard(entry)
    );
  });
}


/* =========================================================
   十八、主题管理
   ========================================================= */

// 读取主题
function loadVocabularyTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

  const isLight = savedTheme === "light";

  document.body.classList.toggle(
    "vocabulary-light",
    isLight
  );

  updateThemeButton(isLight);
}


// 更新主题按钮
function updateThemeButton(isLight) {
  if (themeIcon) {
    themeIcon.textContent = isLight ? "☾" : "☼";
  }

  if (themeText) {
    themeText.textContent = isLight
      ? "Dark Mode"
      : "Light Mode";
  }
}


// 切换主题
function toggleVocabularyTheme() {
  const isLight = document.body.classList.toggle(
    "vocabulary-light"
  );

  localStorage.setItem(
    THEME_STORAGE_KEY,
    isLight ? "light" : "dark"
  );

  updateThemeButton(isLight);
}


/* =========================================================
   十九、JSON 数据备份
   ========================================================= */

// 导出 JSON 文件
function exportVocabularyJSON() {
  const exportData = {
    format: "language-lab-vocabulary",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: vocabularyData
  };

  const blob = new Blob(
    [JSON.stringify(exportData, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;

  link.download = `language-lab-vocabulary-${getCurrentDate()}.json`;

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);
}


// 导入 JSON 文件
function importVocabularyJSON(file) {
  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);

      let importedData;

      if (Array.isArray(parsed)) {
        importedData = parsed;

      } else if (
        parsed &&
        parsed.format === "language-lab-vocabulary" &&
        Array.isArray(parsed.data)
      ) {
        importedData = parsed.data;

      } else {
        throw new Error("不支持的 JSON 文件格式");
      }

      const normalized = validateVocabularyData(importedData);

      if (!normalized) {
        throw new Error("词汇数据格式不正确");
      }

      const confirmed = confirm(
        `即将导入 ${normalized.length} 条词汇。\n\n导入后将替换当前本地词库，是否继续？建议先导出备份。`
      );

      if (!confirmed) {
        return;
      }

      vocabularyData = normalized;

      saveVocabulary();

      alert("词汇导入成功！");

    } catch (error) {
      console.error("导入失败：", error);

      alert(`导入失败：${error.message}`);
    }
  };

  reader.onerror = () => {
    alert("读取文件失败，请重试。");
  };

  reader.readAsText(file, "UTF-8");
}


/* =========================================================
   二十、备份工具栏
   ========================================================= */

// 创建备份工具栏
function createBackupControls() {
  if (!vocabularyList || !vocabularyList.parentElement) {
    return;
  }

  if (document.getElementById("vocabulary-backup-toolbar")) {
    return;
  }

  const toolbar = document.createElement("div");

  toolbar.id = "vocabulary-backup-toolbar";
  toolbar.className = "vocabulary-backup-actions";

  toolbar.innerHTML = `
    <button
      id="export-vocabulary-button"
      class="backup-button"
      type="button"
    >
      ↓ Export JSON
    </button>

    <button
      id="import-vocabulary-button"
      class="backup-button"
      type="button"
    >
      ↑ Import JSON
    </button>

    <input
      id="import-vocabulary-file"
      type="file"
      accept=".json,application/json"
      hidden
    >

    <div class="backup-info">
      <div class="backup-info-title">LOCAL DATA BACKUP</div>
      <p class="backup-info-description">
        可以将词汇库导出为 JSON 文件，也可以从备份文件恢复数据。
      </p>
      <p class="backup-info-tip">
        提示：导入操作会替换当前本地词库，建议先导出一份备份。
      </p>
    </div>
  `;

  vocabularyList.parentElement.insertBefore(
    toolbar,
    vocabularyList
  );

  const exportButton = toolbar.querySelector(
    "#export-vocabulary-button"
  );

  const importButton = toolbar.querySelector(
    "#import-vocabulary-button"
  );

  const fileInput = toolbar.querySelector(
    "#import-vocabulary-file"
  );

  exportButton.addEventListener(
    "click",
    exportVocabularyJSON
  );

  importButton.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", event => {
    const file = event.target.files[0];

    importVocabularyJSON(file);

    event.target.value = "";
  });
}


/* =========================================================
   二十一、云同步状态提示
   ========================================================= */

// 更新云同步状态
function setSyncStatus(message, state = "normal") {
  const status = document.getElementById(
    "vocabulary-sync-status"
  );

  if (!status) {
    return;
  }

  status.textContent = message;

  status.dataset.state = state;
}


/* =========================================================
   二十二、Cloudflare Worker 请求
   ========================================================= */

// 统一 API 请求
async function syncRequest(path, options = {}) {
  const response = await fetch(
    `${SYNC_API}${path}`,
    {
      credentials: "include",
      ...options
    }
  );

  if (!response.ok) {
    const message = await response.text();

    throw new Error(
      `HTTP ${response.status}: ${message || response.statusText}`
    );
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();

  return text ? safeJSONParse(text, text) : null;
}


/* =========================================================
   二十三、云同步工具栏
   ========================================================= */

// 创建云同步工具栏
function createSyncControls() {
  if (!vocabularyList || !vocabularyList.parentElement) {
    return;
  }

  if (document.getElementById("vocabulary-sync-toolbar")) {
    return;
  }

  const toolbar = document.createElement("div");

  toolbar.id = "vocabulary-sync-toolbar";
  toolbar.className = "vocabulary-sync-toolbar";

  toolbar.innerHTML = `
    <button
      id="vocabulary-cloud-login"
      class="backup-button"
      type="button"
    >
      ↗ GitHub Login
    </button>

    <button
      id="vocabulary-cloud-sync"
      class="backup-button"
      type="button"
    >
      ↻ Sync Now
    </button>

    <button
      id="vocabulary-cloud-logout"
      class="backup-button"
      type="button"
    >
      Logout
    </button>

    <span
      id="vocabulary-sync-status"
      class="vocabulary-sync-status"
      data-state="normal"
    >
      正在检查云同步状态……
    </span>
  `;

  vocabularyList.parentElement.insertBefore(
    toolbar,
    vocabularyList
  );

  const loginButton = toolbar.querySelector(
    "#vocabulary-cloud-login"
  );

  const syncButton = toolbar.querySelector(
    "#vocabulary-cloud-sync"
  );

  const logoutButton = toolbar.querySelector(
    "#vocabulary-cloud-logout"
  );

  loginButton.addEventListener("click", loginCloud);

  syncButton.addEventListener("click", () => {
    syncQueue = syncQueue
      .then(() => performCloudSync(true))
      .catch(error => {
        console.error("手动同步失败：", error);
      });
  });

  logoutButton.addEventListener("click", logoutCloud);
}


/* =========================================================
   二十四、检查 GitHub 登录状态
   ========================================================= */

// 检查授权状态
async function checkCloudAuthStatus() {
  try {
    const result = await syncRequest("/auth/status");

    isCloudAuthenticated = Boolean(
      result &&
      (
        result.authenticated ||
        result.loggedIn ||
        result.user
      )
    );

    updateCloudButtons();

    return isCloudAuthenticated;

  } catch (error) {
    console.error("检查登录状态失败：", error);

    isCloudAuthenticated = false;

    updateCloudButtons();

    return false;
  }
}


// 更新云同步按钮
function updateCloudButtons() {
  const loginButton = document.getElementById(
    "vocabulary-cloud-login"
  );

  const syncButton = document.getElementById(
    "vocabulary-cloud-sync"
  );

  const logoutButton = document.getElementById(
    "vocabulary-cloud-logout"
  );

  if (loginButton) {
    loginButton.hidden = isCloudAuthenticated;
  }

  if (syncButton) {
    syncButton.disabled = !isCloudAuthenticated;
  }

  if (logoutButton) {
    logoutButton.hidden = !isCloudAuthenticated;
  }
}


/* =========================================================
   二十五、GitHub 登录与退出
   ========================================================= */

// 发起 GitHub 登录
function loginCloud() {
  window.location.href = `${SYNC_API}/auth/login`;
}


// 退出 GitHub 登录
async function logoutCloud() {
  const confirmed = confirm("确定要退出云同步登录吗？");

  if (!confirmed) {
    return;
  }

  try {
    await syncRequest("/auth/logout", {
      method: "POST"
    });

    isCloudAuthenticated = false;

    updateCloudButtons();

    setSyncStatus("已退出云同步", "normal");

  } catch (error) {
    console.error("退出登录失败：", error);

    setSyncStatus("退出失败，请稍后重试", "error");
  }
}


/* =========================================================
   二十六、读取云端词汇
   ========================================================= */

// 获取云端词汇
async function loadCloudVocabulary() {
  const result = await syncRequest("/api/vocabulary");

  if (!result || typeof result !== "object") {
    return null;
  }

  // 兼容不同版本的返回字段
  const cloudData = Array.isArray(result.data)
    ? result.data
    : Array.isArray(result.vocabulary)
      ? result.vocabulary
      : null;

  if (!cloudData) {
    return null;
  }

  cloudRevision =
    result.sha ||
    result.revision ||
    null;

  return validateVocabularyData(cloudData);
}


/* =========================================================
   二十七、写入云端词汇
   ========================================================= */

// 将本地词汇上传到云端
async function uploadCloudVocabulary() {
  const payload = {
    data: vocabularyData,
    sha: cloudRevision
  };

  const result = await syncRequest("/api/vocabulary", {
    method: "POST",

    headers: {
      "Content-Type": "text/plain;charset=UTF-8"
    },

    body: JSON.stringify(payload)
  });

  if (result && (result.sha || result.revision)) {
    cloudRevision = result.sha || result.revision;
  }

  return result;
}


/* =========================================================
   二十八、云端初始化
   ========================================================= */

// 初始化云端数据
async function initializeCloudSync() {
  if (cloudInitialized) {
    return;
  }

  cloudInitialized = true;

  const authenticated = await checkCloudAuthStatus();

  if (!authenticated) {
    setSyncStatus("本地模式 · 登录 GitHub 开启云同步", "normal");
    return;
  }

  try {
    setSyncStatus("正在读取云端词库……", "normal");

    const cloudData = await loadCloudVocabulary();

    if (!cloudData) {
      setSyncStatus("云端暂无可用数据", "normal");
      return;
    }

    // 本地没有数据时，直接使用云端数据
    if (!hasLocalData || vocabularyData.length === 0) {
      vocabularyData = cloudData;

      saveLocalVocabulary();

      renderVocabulary();

      setSyncStatus("已从云端恢复词库", "success");

      return;
    }

    // 本地和云端都有数据时，不自动覆盖任意一方
    setSyncStatus(
      "本地与云端均有数据，请确认后再手动同步",
      "normal"
    );

  } catch (error) {
    console.error("初始化云同步失败：", error);

    setSyncStatus("云端连接失败，请稍后重试", "error");
  }
}


/* =========================================================
   二十九、自动云同步
   ========================================================= */

// 安排自动同步
function scheduleCloudSync() {
  if (!isCloudAuthenticated) {
    return;
  }

  clearTimeout(syncTimer);

  syncTimer = setTimeout(() => {
    syncQueue = syncQueue
      .then(() => performCloudSync(false))
      .catch(error => {
        console.error("自动同步失败：", error);
      });

  }, SYNC_DELAY);
}


// 执行云同步
async function performCloudSync(manual = false) {
  if (!isCloudAuthenticated) {
    setSyncStatus("请先登录 GitHub", "normal");
    return;
  }

  if (isSyncing) {
    return;
  }

  isSyncing = true;

  try {
    setSyncStatus("正在同步……", "normal");

    await uploadCloudVocabulary();

    setSyncStatus(
      manual ? "手动同步成功" : "自动同步成功",
      "success"
    );

  } catch (error) {
    console.error("云同步失败：", error);

    const message = safeString(error.message);

    if (
      message.includes("409") ||
      message.toLowerCase().includes("sha") ||
      message.toLowerCase().includes("conflict")
    ) {
      setSyncStatus(
        "云端版本发生变化，请重新读取云端数据",
        "error"
      );

    } else {
      setSyncStatus("同步失败：" + message, "error");
    }

  } finally {
    isSyncing = false;
  }
}


/* =========================================================
   三十、手动同步
   ========================================================= */

// 从云端重新读取
async function refreshFromCloud() {
  if (!isCloudAuthenticated) {
    setSyncStatus("请先登录 GitHub", "normal");
    return;
  }

  const confirmed = confirm(
    "从云端重新读取会覆盖当前本地词库，确定继续吗？建议先导出备份。"
  );

  if (!confirmed) {
    return;
  }

  try {
    setSyncStatus("正在读取云端数据……", "normal");

    const cloudData = await loadCloudVocabulary();

    if (!cloudData) {
      setSyncStatus("云端没有可用词汇数据", "normal");
      return;
    }

    vocabularyData = cloudData;

    saveLocalVocabulary();

    renderVocabulary();

    setSyncStatus("云端数据读取成功", "success");

  } catch (error) {
    console.error("读取云端失败：", error);

    setSyncStatus("读取云端失败：" + error.message, "error");
  }
}


/* =========================================================
   三十一、动态按钮事件
   ========================================================= */

// 处理动态添加按钮
function handleAddFieldClick(event) {
  const button = event.target.closest(".add-field-button");

  if (!button) {
    return;
  }

  const type = button.dataset.type;
  const target = button.dataset.target;

  if (type === "expression") {
    const language = Object.keys(WORD_CONTAINER_IDS).find(
      key => WORD_CONTAINER_IDS[key] === target
    );

    if (language) {
      addExpressionField(language);
    }

    return;
  }

  if (type === "example") {
    const language = Object.keys(EXAMPLE_CONTAINER_IDS).find(
      key => EXAMPLE_CONTAINER_IDS[key] === target
    );

    if (language) {
      addExampleField(language);
    }
  }
}


/* =========================================================
   三十二、词条操作事件
   ========================================================= */

// 处理词条编辑和删除
function handleVocabularyAction(event) {
  const editButton = event.target.closest(".edit-entry-button");

  if (editButton) {
    fillEditForm(editButton.dataset.id);
    return;
  }

  const deleteButton = event.target.closest(".delete-entry-button");

  if (deleteButton) {
    deleteEntry(deleteButton.dataset.id);
  }
}


/* =========================================================
   三十三、页面事件绑定
   ========================================================= */

// 绑定所有页面事件
function bindEvents() {
  // 新增词条
  if (addEntryButton) {
    addEntryButton.addEventListener(
      "click",
      openNewEntryForm
    );
  }

  // 取消表单
  if (cancelEntryButton) {
    cancelEntryButton.addEventListener(
      "click",
      closeEntryForm
    );
  }

  // 提交表单
  if (vocabularyForm) {
    vocabularyForm.addEventListener(
      "submit",
      handleFormSubmit
    );
  }

  // 动态增加表达与例句
  if (entryFormPanel) {
    entryFormPanel.addEventListener(
      "click",
      handleAddFieldClick
    );
  }

  // 词条编辑与删除
  if (vocabularyList) {
    vocabularyList.addEventListener(
      "click",
      handleVocabularyAction
    );
  }

  // 搜索
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      renderVocabulary();
    });
  }

  // 语言筛选
  if (languageFilter) {
    languageFilter.addEventListener("change", () => {
      activeAlphabet = "all";
      renderVocabulary();
    });
  }

  // A-Z 导航
  if (alphabetFilter) {
    alphabetFilter.addEventListener(
      "click",
      handleAlphabetClick
    );
  }

  // 主题切换
  if (themeToggle) {
    themeToggle.addEventListener(
      "click",
      toggleVocabularyTheme
    );
  }
}


/* =========================================================
   三十四、URL 语言参数
   ========================================================= */

// 根据 URL 参数初始化语言筛选
function initializeLanguageFromURL() {
  const params = new URLSearchParams(window.location.search);

  const language = params.get("language");

  const allowedLanguages = [
    "all",
    "english",
    "french",
    "russian",
    "chinese"
  ];

  if (
    languageFilter &&
    language &&
    allowedLanguages.includes(language)
  ) {
    languageFilter.value = language;
  }
}


/* =========================================================
   三十五、页面初始化
   ========================================================= */

// 页面启动
function initializeVocabulary() {
  // 读取本地词汇
  loadLocalVocabulary();

  // 恢复主题
  loadVocabularyTheme();

  // 初始化动态表达输入框
  initializeExpressionFields();

  // 根据 URL 设置语言筛选
  initializeLanguageFromURL();

  // 创建云同步工具栏
  createSyncControls();

  // 创建 JSON 备份工具栏
  createBackupControls();

  // 绑定事件
  bindEvents();

  // 渲染词汇
  renderVocabulary();

  // 初始化云同步
  initializeCloudSync();
}


// 等待 DOM 加载完成
if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeVocabulary
  );
} else {
  initializeVocabulary();
}