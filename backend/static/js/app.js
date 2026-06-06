document.addEventListener("DOMContentLoaded", () => {
    // ================= DOM ELEMENT REFERENCES =================
    const categoryList = document.getElementById("categoryList");
    const categorySearch = document.getElementById("categorySearch");
    const globalFaqSearch = document.getElementById("globalFaqSearch");
    const searchDropdown = document.getElementById("searchDropdown");
    
    const chatMessages = document.getElementById("chatMessages");
    const chatForm = document.getElementById("chatForm");
    const chatInput = document.getElementById("chatInput");
    const clearChatBtn = document.getElementById("clearChatBtn");
    const suggestionArea = document.getElementById("suggestionArea");
    
    const browserPanel = document.getElementById("browserPanel");
    const browserCategoryTitle = document.getElementById("browserCategoryTitle");
    const browserFaqSearch = document.getElementById("browserFaqSearch");
    const faqAccordionList = document.getElementById("faqAccordionList");
    
    // Mobile Navigation Controls
    const openSidebarBtn = document.getElementById("openSidebarBtn");
    const closeSidebarBtn = document.getElementById("closeSidebarBtn");
    const sidebarPanel = document.getElementById("sidebarPanel");
    const sidebarOverlay = document.getElementById("sidebarOverlay");
    
    const openBrowserBtn = document.getElementById("openBrowserBtn");
    const closeBrowserBtn = document.getElementById("closeBrowserBtn");
    const browserOverlay = document.getElementById("browserOverlay");

    // Theme Toggle and Search History Elements
    const themeToggleBtn = document.getElementById("themeToggleBtn");
    const sunIcon = document.getElementById("sunIcon");
    const moonIcon = document.getElementById("moonIcon");
    const historyList = document.getElementById("historyList");
    const clearHistoryBtn = document.getElementById("clearHistoryBtn");

    // Global State
    let categoriesData = [];
    let currentCategoryFaqs = [];
    let activeCategory = null;
    let searchDebounceTimeout = null;
    let searchHistory = [];

    // ================= LIGHTWEIGHT MARKDOWN PARSER =================
    function parseMarkdown(text) {
        if (!text) return "";
        
        let html = text;

        // Escape HTML tags to prevent XSS
        html = html
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Code blocks: ```python ... ```
        html = html.replace(/```(?:[a-zA-Z0-9]*)\n([\s\S]*?)\n```/g, (match, code) => {
            return `<pre><code>${code}</code></pre>`;
        });

        // Inline code: `code`
        html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

        // Bold text: **text**
        html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

        // Unordered lists: - item or * item
        // Replace single items first, then wrap sequences
        html = html.replace(/^(?:\s*[-*]\s+)(.+)$/gm, "<li>$1</li>");
        
        // Wrap contiguous <li> blocks in <ul>
        // Match sequence of one or more <li>...</li> tags
        html = html.replace(/((?:<li>.*?<\/li>\s*)+)/gs, "<ul>$1</ul>");

        // Headers
        html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");
        html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");
        html = html.replace(/^# (.*)$/gm, "<h1>$1</h1>");

        // Line breaks (convert remaining \n to <br>, ignoring inside tags)
        // A simple way is to replace newlines not inside <pre> blocks.
        // For simplicity, replace standard \n with <br>, then fix pre-formatted tags
        html = html.replace(/\n/g, "<br>");
        html = html.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, (match, code) => {
            // Restore actual newlines in code blocks
            return `<pre><code>${code.replace(/<br>/g, "\n")}</code></pre>`;
        });
        
        // Fix list structures where newlines caused <br> inside or around <ul>/<li>
        html = html.replace(/<\/ul><br>/g, "<\/ul>");
        html = html.replace(/<\/li><br>/g, "<\/li>");
        html = html.replace(/<ul><br>/g, "<ul>");
        
        return html;
    }

    // ================= CHAT LOGIC AND BUBBLES =================
    function appendMessage(text, isUser = false) {
        const messageDiv = document.createElement("div");
        messageDiv.classList.add("message");
        messageDiv.classList.add(isUser ? "user-message" : "bot-message");

        const avatar = document.createElement("div");
        avatar.classList.add("message-avatar");
        avatar.textContent = isUser ? "U" : "AI";

        const wrapper = document.createElement("div");
        wrapper.classList.add("message-bubble-wrapper");

        const bubble = document.createElement("div");
        bubble.classList.add("message-bubble");
        
        if (isUser) {
            bubble.textContent = text;
        } else {
            bubble.innerHTML = parseMarkdown(text);
        }

        const time = document.createElement("span");
        time.classList.add("message-time");
        const now = new Date();
        time.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        wrapper.appendChild(bubble);
        wrapper.appendChild(time);
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(wrapper);
        
        chatMessages.appendChild(messageDiv);
        scrollToBottom();
        return messageDiv;
    }

    function showTypingIndicator() {
        const indicatorDiv = document.createElement("div");
        indicatorDiv.classList.add("message", "bot-message", "typing-message");
        indicatorDiv.id = "typingIndicator";

        const avatar = document.createElement("div");
        avatar.classList.add("message-avatar");
        avatar.textContent = "AI";

        const wrapper = document.createElement("div");
        wrapper.classList.add("message-bubble-wrapper");

        const bubble = document.createElement("div");
        bubble.classList.add("message-bubble");
        
        bubble.innerHTML = `
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;

        wrapper.appendChild(bubble);
        indicatorDiv.appendChild(avatar);
        indicatorDiv.appendChild(wrapper);
        
        chatMessages.appendChild(indicatorDiv);
        scrollToBottom();
    }

    function removeTypingIndicator() {
        const indicator = document.getElementById("typingIndicator");
        if (indicator) {
            indicator.remove();
        }
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function renderSuggestions(suggestions = []) {
        suggestionArea.innerHTML = "";
        
        // If no suggestions are provided, let's load 3 random categories
        if (suggestions.length === 0 && categoriesData.length > 0) {
            // Default suggestions based on current category or common ones
            const defaultQs = [
                "What is the difference between list and tuple in Python?",
                "What are the OOP concepts in Java?",
                "What is a dangling pointer in C?"
            ];
            suggestions = defaultQs;
        }

        suggestions.slice(0, 3).forEach(qText => {
            const chip = document.createElement("button");
            chip.classList.add("suggestion-chip");
            chip.textContent = qText;
            chip.addEventListener("click", () => {
                chatInput.value = qText;
                submitQuery(qText);
            });
            suggestionArea.appendChild(chip);
        });
    }

    async function submitQuery(queryText) {
        if (!queryText.trim()) return;

        // Add to search history list
        addToHistory(queryText.trim());

        // Reset inputs
        chatInput.value = "";
        renderSuggestions([]); // Clear suggestion chips

        // Append User Bubble
        appendMessage(queryText, true);

        // Show typing animation
        showTypingIndicator();

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ message: queryText })
            });
            const data = await response.json();

            // Delay slightly for premium UX feel
            setTimeout(() => {
                removeTypingIndicator();
                
                if (response.ok) {
                    appendMessage(data.reply, false);
                    if (data.matched_faq) {
                        // Highlight or switch category browser to the matched category
                        selectCategory(data.matched_faq.category, false);
                    }
                    
                    // Render suggestions if return (suggestions or weak matches suggestions)
                    if (data.suggestions && data.suggestions.length > 0) {
                        renderSuggestions(data.suggestions);
                    } else if (data.success && data.matched_faq) {
                        // Provide 2 related questions from same category
                        getRelatedQuestions(data.matched_faq.category, data.matched_faq.id);
                    } else {
                        renderSuggestions([]);
                    }
                } else {
                    appendMessage("Oops, I encountered a communication error with my NLP matching engine. Please try again.", false);
                    renderSuggestions([]);
                }
            }, 600);

        } catch (error) {
            console.error("Chat error:", error);
            setTimeout(() => {
                removeTypingIndicator();
                appendMessage("Failed to reach the server. Please verify the Flask server is running.", false);
                renderSuggestions([]);
            }, 600);
        }
    }

    async function getRelatedQuestions(category, currentId) {
        try {
            const response = await fetch(`/api/faqs?category=${encodeURIComponent(category)}`);
            const data = await response.json();
            if (data.success && data.faqs) {
                const related = data.faqs
                    .filter(faq => faq.id !== currentId)
                    .map(faq => faq.question);
                renderSuggestions(related);
            }
        } catch (e) {
            console.error("Error loading related questions", e);
        }
    }

    // ================= CATEGORIES SIDEBAR =================
    async function loadCategories() {
        try {
            const response = await fetch("/api/categories");
            const data = await response.json();
            
            if (data.success && data.categories) {
                categoriesData = data.categories;
                renderCategories(categoriesData);
                
                // Select first category by default on browser panel
                if (categoriesData.length > 0) {
                    selectCategory(categoriesData[0].name, false);
                }
            }
        } catch (error) {
            console.error("Error loading categories:", error);
            categoryList.innerHTML = `<li class="loading-placeholder" style="color: var(--accent-purple);">Error loading categories</li>`;
        }
    }

    function renderCategories(categories) {
        categoryList.innerHTML = "";
        if (categories.length === 0) {
            categoryList.innerHTML = `<li class="loading-placeholder">No categories found</li>`;
            return;
        }

        categories.forEach(cat => {
            const li = document.createElement("li");
            li.classList.add("category-item");
            if (activeCategory === cat.name) {
                li.classList.add("active");
            }
            
            li.innerHTML = `
                <span class="category-name">${cat.name}</span>
                <span class="category-count">${cat.count}</span>
            `;
            
            li.addEventListener("click", () => {
                selectCategory(cat.name, true);
                
                // Close sidebar on mobile drawer view
                if (window.innerWidth <= 900) {
                    sidebarPanel.classList.remove("show");
                }
            });
            
            categoryList.appendChild(li);
        });
    }

    categorySearch.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = categoriesData.filter(cat => 
            cat.name.toLowerCase().includes(query)
        );
        renderCategories(filtered);
    });

    // ================= FAQ BROWSER ACCORDION =================
    async function selectCategory(categoryName, shouldOpenBrowser = true) {
        activeCategory = categoryName;
        browserCategoryTitle.textContent = `Browse: ${categoryName}`;
        
        // Highlight active category in sidebar
        const items = categoryList.querySelectorAll(".category-item");
        items.forEach(item => {
            const nameSpan = item.querySelector(".category-name");
            if (nameSpan && nameSpan.textContent === categoryName) {
                item.classList.add("active");
            } else {
                item.classList.remove("active");
            }
        });

        // Trigger open browser panel on mobile if clicked
        if (shouldOpenBrowser && window.innerWidth <= 900) {
            browserPanel.classList.add("show");
        }

        // Fetch category FAQs
        try {
            faqAccordionList.innerHTML = `<div class="loading-placeholder">Loading FAQs...</div>`;
            const response = await fetch(`/api/faqs?category=${encodeURIComponent(categoryName)}`);
            const data = await response.json();
            
            if (data.success && data.faqs) {
                currentCategoryFaqs = data.faqs;
                renderAccordion(currentCategoryFaqs);
            }
        } catch (error) {
            console.error("Error loading category FAQs:", error);
            faqAccordionList.innerHTML = `<div class="empty-state">Error loading FAQs.</div>`;
        }
    }

    function renderAccordion(faqs) {
        faqAccordionList.innerHTML = "";
        
        if (faqs.length === 0) {
            faqAccordionList.innerHTML = `<div class="empty-state">No questions found in this category.</div>`;
            return;
        }

        faqs.forEach(faq => {
            const item = document.createElement("div");
            item.classList.add("accordion-item");
            item.dataset.faqId = faq.id;

            const trigger = document.createElement("div");
            trigger.classList.add("accordion-trigger");
            trigger.innerHTML = `
                <h4>${faq.question}</h4>
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="6 9 12 15 18 9"></polyline></svg>
            `;

            const content = document.createElement("div");
            content.classList.add("accordion-content");

            const body = document.createElement("div");
            body.classList.add("accordion-body");
            body.innerHTML = parseMarkdown(faq.answer);

            const footer = document.createElement("div");
            footer.classList.add("accordion-footer");
            
            const askBtn = document.createElement("button");
            askBtn.classList.add("ask-shortcut-btn");
            askBtn.textContent = "Ask in Chat 💬";
            askBtn.addEventListener("click", (e) => {
                e.stopPropagation(); // Prevent closing accordion
                submitQuery(faq.question);
                
                // On mobile, close browser drawer once asking
                if (window.innerWidth <= 900) {
                    browserPanel.classList.remove("show");
                }
            });

            footer.appendChild(askBtn);
            content.appendChild(body);
            content.appendChild(footer);
            
            item.appendChild(trigger);
            item.appendChild(content);
            
            // Toggle Accordion Click Event
            trigger.addEventListener("click", () => {
                const isActive = item.classList.contains("active");
                
                // Close all other accordion items in right panel
                const activeItems = faqAccordionList.querySelectorAll(".accordion-item.active");
                activeItems.forEach(ai => {
                    ai.classList.remove("active");
                    ai.querySelector(".accordion-content").style.maxHeight = null;
                });

                if (!isActive) {
                    item.classList.add("active");
                    // Dynamic height transition calculation
                    content.style.maxHeight = content.scrollHeight + "px";
                } else {
                    item.classList.remove("active");
                    content.style.maxHeight = null;
                }
            });

            faqAccordionList.appendChild(item);
        });
    }

    // Filter Accordion Items inside selected Category
    browserFaqSearch.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = currentCategoryFaqs.filter(faq => 
            faq.question.toLowerCase().includes(query) || 
            faq.answer.toLowerCase().includes(query)
        );
        renderAccordion(filtered);
    });

    // ================= GLOBAL SEARCH =================
    globalFaqSearch.addEventListener("input", (e) => {
        const query = e.target.value.trim();
        clearTimeout(searchDebounceTimeout);
        
        if (!query) {
            searchDropdown.innerHTML = "";
            searchDropdown.classList.remove("show");
            return;
        }

        // Debounce search requests to preserve bandwidth & CPU cycles
        searchDebounceTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=5`);
                const data = await response.json();
                
                if (data.success && data.results) {
                    renderSearchDropdown(data.results);
                }
            } catch (error) {
                console.error("Error carrying out global search:", error);
            }
        }, 200);
    });

    function renderSearchDropdown(results) {
        searchDropdown.innerHTML = "";
        
        if (results.length === 0) {
            searchDropdown.innerHTML = `<div class="dropdown-empty">No matching FAQs found.</div>`;
            searchDropdown.classList.add("show");
            return;
        }

        results.forEach(result => {
            const item = document.createElement("div");
            item.classList.add("dropdown-item");
            
            const scorePercent = Math.round(result.score * 100);
            
            item.innerHTML = `
                <div class="dropdown-q">${result.faq.question}</div>
                <div class="dropdown-cat-score">
                    <span class="cat">${result.faq.category}</span>
                    <span>Match Confidence: ${scorePercent}%</span>
                </div>
            `;
            
            item.addEventListener("click", () => {
                submitQuery(result.faq.question);
                globalFaqSearch.value = "";
                searchDropdown.innerHTML = "";
                searchDropdown.classList.remove("show");
            });

            searchDropdown.appendChild(item);
        });

        searchDropdown.classList.add("show");
    }

    // Close global search dropdown when clicking outside
    document.addEventListener("click", (e) => {
        if (!globalFaqSearch.contains(e.target) && !searchDropdown.contains(e.target)) {
            searchDropdown.classList.remove("show");
        }
    });

    // ================= CHAT ACTIONS =================
    chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (text) {
            submitQuery(text);
        }
    });

    clearChatBtn.addEventListener("click", () => {
        chatMessages.innerHTML = `
            <div class="message bot-message">
                <div class="message-avatar">AI</div>
                <div class="message-bubble-wrapper">
                    <div class="message-bubble">
                        <p>Chat cleared. How can I help you with your developer questions now? ⚡</p>
                    </div>
                    <span class="message-time">Just now</span>
                </div>
            </div>
        `;
        renderSuggestions([]);
    });

    // ================= MOBILE SLIDEOUT DRAWERS =================
    openSidebarBtn.addEventListener("click", () => {
        sidebarPanel.classList.add("show");
    });

    closeSidebarBtn.addEventListener("click", () => {
        sidebarPanel.classList.remove("show");
    });

    sidebarOverlay.addEventListener("click", () => {
        sidebarPanel.classList.remove("show");
    });

    openBrowserBtn.addEventListener("click", () => {
        browserPanel.classList.add("show");
    });

    closeBrowserBtn.addEventListener("click", () => {
        browserPanel.classList.remove("show");
    });

    browserOverlay.addEventListener("click", () => {
        browserPanel.classList.remove("show");
    });

    // Handle viewport resize (safety cleanups)
    window.addEventListener("resize", () => {
        if (window.innerWidth > 900) {
            sidebarPanel.classList.remove("show");
            browserPanel.classList.remove("show");
        }
    });

    // ================= DARK / LIGHT THEME TOGGLE =================
    function initTheme() {
        const savedTheme = localStorage.getItem("theme") || "dark";
        if (savedTheme === "light") {
            document.body.classList.add("light-theme");
            sunIcon.style.display = "none";
            moonIcon.style.display = "block";
        } else {
            document.body.classList.remove("light-theme");
            sunIcon.style.display = "block";
            moonIcon.style.display = "none";
        }
    }

    function toggleTheme() {
        const isLightTheme = document.body.classList.toggle("light-theme");
        if (isLightTheme) {
            localStorage.setItem("theme", "light");
            sunIcon.style.display = "none";
            moonIcon.style.display = "block";
        } else {
            localStorage.setItem("theme", "dark");
            sunIcon.style.display = "block";
            moonIcon.style.display = "none";
        }
    }

    // ================= SEARCH HISTORY PERSISTENCE =================
    function initHistory() {
        try {
            const savedHistory = localStorage.getItem("searchHistory");
            searchHistory = savedHistory ? JSON.parse(savedHistory) : [];
        } catch (e) {
            console.error("Error loading search history:", e);
            searchHistory = [];
        }
        renderHistory();
    }

    function addToHistory(query) {
        if (!query) return;
        
        // Avoid duplicate consecutive entries
        if (searchHistory.length > 0 && searchHistory[0].toLowerCase() === query.toLowerCase()) {
            return;
        }

        // Clean out existing duplicates in history
        searchHistory = searchHistory.filter(item => item.toLowerCase() !== query.toLowerCase());
        
        // Add to front of history list
        searchHistory.unshift(query);
        
        // Restrict list to 10 entries max
        if (searchHistory.length > 10) {
            searchHistory.pop();
        }

        localStorage.setItem("searchHistory", JSON.stringify(searchHistory));
        renderHistory();
    }

    function renderHistory() {
        historyList.innerHTML = "";
        
        if (searchHistory.length === 0) {
            historyList.innerHTML = `<li class="loading-placeholder">No recent searches</li>`;
            return;
        }

        searchHistory.forEach(query => {
            const li = document.createElement("li");
            li.classList.add("history-item");
            
            li.innerHTML = `
                <svg class="history-item-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <span class="history-item-text" title="${query}">${query}</span>
            `;
            
            li.addEventListener("click", () => {
                chatInput.value = query;
                submitQuery(query);
            });
            
            historyList.appendChild(li);
        });
    }

    function clearHistory() {
        searchHistory = [];
        localStorage.removeItem("searchHistory");
        renderHistory();
    }

    // Bind theme toggle listener
    themeToggleBtn.addEventListener("click", toggleTheme);
    
    // Bind clear history listener
    clearHistoryBtn.addEventListener("click", clearHistory);

    // ================= APP INITIALIZATION =================
    initTheme();
    initHistory();
    loadCategories();
    renderSuggestions([]); // Renders default suggestions
});
