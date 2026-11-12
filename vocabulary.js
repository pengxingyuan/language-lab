
/* ==================================================
   Language Lab · Vocabulary
   四语词汇库：动态录入、本地保存、读取、搜索与展示
   ================================================== */

// 本地存储名称
const STORAGE_KEY = "languageLab_vocabulary";
const THEME_STORAGE_KEY = "languageLab_vocabulary_theme";

// 获取页面元素
const addEntryButton = document.getElementById("add-entry-button");
const cancelEntryButton = document.getElementById("cancel-entry-button");
const entryFormPanel = document.getElementById("entry-form-panel");
const vocabularyForm = document.getElementById("vocabulary-form");
const vocabularyList = document.getElementById("vocabulary-list");
const totalCount = document.getElementById("total-count");

// 获取搜索区域元素
const vocabularySearchInput = document.getElementById("vocabulary-search-input");
const vocabularySearchLanguage = document.getElementById("vocabulary-search-language");
const vocabularySearchStatus = document.getElementById("vocabulary-search-status");

// 获取主题切换按钮
const vocabularyThemeToggle = document.getElementById("vocabularyThemeToggle");
const vocabularyThemeIcon = document.getElementById("vocabularyThemeIcon");
const vocabularyThemeText = document.getElementById("vocabularyThemeText");

// 获取三个语言的表达容器
const expressionContainers = {
  english: document.getElementById("english-words"),
  french: document.getElementById("french-words"),
  russian: document.getElementById("russian-words")
};

// 获取三个语言的例句容器
const exampleContainers = {
  english: document.getElementById("english-examples"),
  french: document.getElementById("french-examples"),
  russian: document.getElementById("russian-examples")
};

// ==================================================
// 一、主题管理
// ==================================================

// 设置词汇本主题
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

// 读取上次保存的主题
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

// 点击按钮切换主题
if (vocabularyThemeToggle) {
  vocabularyThemeToggle.addEventListener("click", () => {
    const isCurrentlyLight = document.body.classList.contains("vocabulary-light");

    setVocabularyTheme(isCurrentlyLight ? "dark" : "light");
  });
}

// ==================================================
// 二、本地数据管理
// ==================================================

// 从浏览器读取已经保存的词汇
function loadVocabulary() {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);
    const parsedData = savedData ? JSON.parse(savedData) : [];

    return Array.isArray(parsedData) ? parsedData : [];
  } catch (error) {
    console.error("读取词汇失败：", error);
    alert("读取本地词汇时发生错误，请检查浏览器数据。");
    return [];
  }
}

// 当前词汇列表
let vocabularyData = loadVocabulary();

// 保存词汇到浏览器
function saveVocabulary() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vocabularyData));
    return true;
  } catch (error) {
    console.error("保存词汇失败：", error);
    alert("保存失败，可能是浏览器存储空间不足。");
    return false;
  }
}

// ==================================================
// 三、页面显示与隐藏
// ==================================================

// 打开录入面板
addEntryButton.addEventListener("click", () => {
  entryFormPanel.hidden = false;

  entryFormPanel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

// 关闭录入面板
cancelEntryButton.addEventListener("click", () => {
  entryFormPanel.hidden = true;
});

// ==================================================
// 四、动态添加表达与例句
// ==================================================

// 创建删除按钮
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

// 添加语言表达
function addExpressionField(container) {
  const wrapper = document.createElement("div");
  wrapper.className = "dynamic-item";

  const originalInput = container.querySelector("input");

  const input = document.createElement("input");
  input.type = "text";
  input.name = originalInput.name;
  input.placeholder = "Add another expression";

  wrapper.appendChild(input);
  wrapper.appendChild(createRemoveButton(wrapper));

  container.appendChild(wrapper);
}

// 添加语言例句
function addExampleField(container) {
  const wrapper = document.createElement("div");
  wrapper.className = "example-item";

  const originalTextarea = container.querySelector("textarea");
  const originalTranslation = container.querySelector('input[name$="-translation"]');

  const textarea = document.createElement("textarea");
  textarea.name = originalTextarea.name;
  textarea.rows = 2;
  textarea.placeholder = "Write another example...";

  const translation = document.createElement("input");
  translation.type = "text";
  translation.name = originalTranslation.name;
  translation.placeholder = "中文对照（可选）";

  wrapper.appendChild(textarea);
  wrapper.appendChild(translation);
  wrapper.appendChild(createRemoveButton(wrapper));

  container.appendChild(wrapper);
}

// 为所有动态添加按钮绑定事件
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
// 五、收集表单数据
// ==================================================

// 获取某种语言的所有表达
function collectExpressions(container) {
  return Array.from(container.querySelectorAll("input"))
    .map(input => input.value.trim())
    .filter(value => value !== "");
}

// 获取某种语言的所有例句
function collectExamples(container) {
  return Array.from(container.querySelectorAll(".example-item"))
    .map(item => ({
      text: item.querySelector("textarea").value.trim(),
      translation: item.querySelector('input[name$="-translation"]').value.trim()
    }))
    .filter(item => item.text !== "" || item.translation !== "");
}

// 整理整张词汇记录
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
// 六、保存词汇
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

    alert("Vocabulary saved successfully!");
  } else {
    vocabularyData.shift();
  }
});

// ==================================================
// 七、重置录入表单
// ==================================================

// 重新创建一个初始例句区域
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

  wrapper.appendChild(textarea);
  wrapper.appendChild(translation);

  return wrapper;
}

// 清空表单并恢复初始输入区域
function resetForm() {
  vocabularyForm.reset();

  // 恢复三个语言的初始表达输入框
  Object.values(expressionContainers).forEach((container) => {
    const inputName = container.querySelector("input").name;

    const input = document.createElement("input");
    input.type = "text";
    input.name = inputName;
    input.placeholder = "Expression";

    container.replaceChildren(input);
  });

  // 恢复三个语言的初始例句输入区域
  Object.values(exampleContainers).forEach((container) => {
    const textareaName = container.querySelector("textarea").name;
    const translationName = container.querySelector('input[name$="-translation"]').name;

    const example = createInitialExample(
      textareaName,
      translationName,
      "Write an example..."
    );

    container.replaceChildren(example);
  });
}

// ==================================================
// 八、通用展示元素
// ==================================================

// 创建安全的文本元素
function createTextElement(tagName, className, content) {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  // 使用 textContent，避免将用户输入当作 HTML 执行
  element.textContent = content ?? "";

  return element;
}

// ==================================================
// 九、词汇卡片展示
// ==================================================

// 创建三语并列区域
function appendLanguageGrid(card, entry) {
  const grid = document.createElement("div");
  grid.className = "entry-language-grid";

  // 三种语言分别对应一个独立栏目
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

// 创建例句区域
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

// 创建完整词汇卡片
function createVocabularyCard(entry) {
  const card = document.createElement("article");
  card.className = "vocabulary-card";

  // 卡片顶部：概念名称与日期
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

  // 中文释义：单独突出展示
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

  // 英语、法语、俄语并列展示
  appendLanguageGrid(card, entry);

  // 三种语言的例句
  const examples = document.createElement("div");
  examples.className = "entry-examples-group";

  appendExampleSection(examples, "ENGLISH EXAMPLES", entry.examples?.english);
  appendExampleSection(examples, "FRANÇAIS EXAMPLES", entry.examples?.french);
  appendExampleSection(examples, "РУССКИЙ EXAMPLES", entry.examples?.russian);

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

  // 删除词汇按钮
  const actions = document.createElement("div");
  actions.className = "entry-actions";

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-entry-button";
  deleteButton.textContent = "Delete Entry";

  deleteButton.addEventListener("click", () => {
    const confirmed = confirm(`确定删除「${entry.concept}」吗？`);

    if (!confirmed) return;

    const oldData = vocabularyData;

    vocabularyData = vocabularyData.filter(item => item.id !== entry.id);

    if (saveVocabulary()) {
      renderVocabulary();
    } else {
      vocabularyData = oldData;
    }
  });

  actions.appendChild(deleteButton);
  card.appendChild(actions);

  return card;
}

// ==================================================
// 十、词汇搜索
// ==================================================

// 将待搜索内容转换为统一的小写字符串
function normalizeSearchText(value) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

// 获取某条词汇记录中指定语言的搜索内容
function getEntrySearchText(entry, language) {
  // 概念名称始终参与搜索
  const contents = [entry.concept];

  // 搜索全部语言
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

  // 搜索英语
  else if (language === "english") {
    contents.push(...(entry.english || []));

    (entry.examples?.english || []).forEach((example) => {
      contents.push(example.text);
    });
  }

  // 搜索法语
  else if (language === "french") {
    contents.push(...(entry.french || []));

    (entry.examples?.french || []).forEach((example) => {
      contents.push(example.text);
    });
  }

  // 搜索俄语
  else if (language === "russian") {
    contents.push(...(entry.russian || []));

    (entry.examples?.russian || []).forEach((example) => {
      contents.push(example.text);
    });
  }

  // 搜索中文
  else if (language === "chinese") {
    contents.push(entry.chinese);

    ["english", "french", "russian"].forEach((key) => {
      (entry.examples?.[key] || []).forEach((example) => {
        contents.push(example.translation);
      });
    });
  }

  return normalizeSearchText(contents.filter(Boolean).join(" "));
}

// 根据搜索条件筛选词汇
function filterVocabulary() {
  const keyword = normalizeSearchText(vocabularySearchInput?.value);
  const language = vocabularySearchLanguage?.value || "all";

  return vocabularyData.filter((entry) => {
    // 没有输入关键词时，保留全部记录
    if (!keyword) return true;

    const searchText = getEntrySearchText(entry, language);

    return searchText.includes(keyword);
  });
}

// ==================================================
// 十一、渲染整个词汇列表
// ==================================================

function renderVocabulary() {
  // 更新词汇总数：始终显示实际保存的总量
  totalCount.textContent = vocabularyData.length;

  // 根据搜索条件获取需要展示的词汇
  const filteredData = filterVocabulary();

  // 更新搜索结果提示
  if (vocabularySearchStatus) {
    const hasSearchCondition =
      normalizeSearchText(vocabularySearchInput?.value) !== "" ||
      (vocabularySearchLanguage?.value || "all") !== "all";

    if (hasSearchCondition) {
      vocabularySearchStatus.textContent =
        `找到 ${filteredData.length} / ${vocabularyData.length} 条词汇`;
    } else {
      vocabularySearchStatus.textContent =
        `共 ${vocabularyData.length} 条词汇`;
    }
  }

  // 清空旧列表
  vocabularyList.replaceChildren();

  // 整个词汇库为空时显示初始提示
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

  // 有词汇但搜索没有匹配结果
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

  // 展示筛选后的词汇
  filteredData.forEach((entry) => {
    vocabularyList.appendChild(createVocabularyCard(entry));
  });
}

// 搜索框输入时立即更新列表
if (vocabularySearchInput) {
  vocabularySearchInput.addEventListener("input", renderVocabulary);
}

// 切换搜索语言时立即更新列表
if (vocabularySearchLanguage) {
  vocabularySearchLanguage.addEventListener("change", renderVocabulary);
}

// ==================================================
// 十二、页面初始化
// ==================================================

// 恢复上次选择的主题
loadVocabularyTheme();

// 读取并展示已经保存的词汇
renderVocabulary();
