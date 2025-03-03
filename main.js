const { Plugin, PluginSettingTab, Setting } = require('obsidian');

function debounce(func, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), delay);
    };
}

class BackToTopPlugin extends Plugin {
    async onload() {
        await this.loadSettings();
        this.createFloatingElements();
        this.addSettingTab(new BackToTopSettingsTab(this.app, this));

        this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.updateMenu()));
        this.registerEvent(this.app.workspace.on('layout-change', () => this.updateMenu()));

        this.refreshHeaderListDebounced = debounce(() => {
            if (this.headerList?.parentElement) {
                this.refreshHeaderList();
            }
        }, 150);

        this.registerEvent(this.app.workspace.on('editor-change', () => {
            this.refreshHeaderListDebounced();
        }));
    }

    async loadSettings() {
        this.settings = Object.assign({
            enableHeaderMenu: true,
            showH1: true,
            showH2: true,
            showH3: true,
        }, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    onunload() {
        this.removeFloatingElements();
    }

    createFloatingElements() {
        this.menuContainer = document.createElement('div');
        Object.assign(this.menuContainer.style, {
            position: 'absolute',
            backgroundColor: 'var(--background-secondary)',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            overflow: 'hidden',
            maxHeight: '50vh',
            overflowY: 'auto',
            display: 'none',
            zIndex: '1000',
            fontFamily: 'Fira Code, monospace'
        });

        this.headerList = document.createElement('div');
        Object.assign(this.headerList.style, {
            padding: '4px 0',
            backgroundColor: 'transparent'
        });

        this.menuContainer.appendChild(this.headerList);

        this.topButton = document.createElement('button');
        this.topButton.innerText = '⇧';
        Object.assign(this.topButton.style, {
            position: 'absolute',
            padding: '8px',
            backgroundColor: 'var(--interactive-accent)',
            color: 'var(--text-on-accent)',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 'bold',
            borderRadius: '8px',
            fontFamily: 'Fira Code, monospace',
            textAlign: 'center',
            fontSize: '20px',
            lineHeight: '1',
            zIndex: '1001',
            transition: 'background-color 0.2s ease, transform 0.1s ease'
        });

        this.topButton.addEventListener('click', () => this.scrollToTop());
        this.topButton.addEventListener('mouseover', () => {
            this.topButton.style.backgroundColor = 'var(--interactive-accent-hover)';
            this.topButton.style.transform = 'scale(1.1)';
        });
        this.topButton.addEventListener('mouseout', () => {
            this.topButton.style.backgroundColor = 'var(--interactive-accent)';
            this.topButton.style.transform = 'scale(1)';
        });
    }

    removeFloatingElements() {
        this.menuContainer?.remove();
        this.topButton?.remove();
    }

    updateMenu() {
        this.removeFloatingElements();

        const activeLeaf = this.app.workspace.activeLeaf;
        const isMarkdown = activeLeaf?.view?.getViewType() === 'markdown';
        const isSourceMode = activeLeaf?.view?.getMode() === 'source';

        if (isMarkdown && isSourceMode) {
            const editorContainer = activeLeaf.view.containerEl?.querySelector('.cm-s-obsidian');

            if (editorContainer) {
                editorContainer.appendChild(this.topButton);
                this.positionFloatingElements(editorContainer);

                if (this.settings.enableHeaderMenu) {
                    editorContainer.appendChild(this.menuContainer);
                    this.menuContainer.style.display = 'block';
                    this.refreshHeaderList();
                    this.registerEvent(this.app.workspace.on('layout-change', () => {
                        this.positionFloatingElements(editorContainer);
                    }));
                }
            }
        }
    }

    positionFloatingElements(editorContainer) {
        const editorWidth = editorContainer.clientWidth;
        const menuWidth = Math.max(120, editorWidth * 0.1);

        this.menuContainer.style.width = `${menuWidth}px`;
        this.menuContainer.style.bottom = '75px';
        this.menuContainer.style.right = '30px';

        this.topButton.style.right = '30px';
        this.topButton.style.bottom = '30px';
        this.topButton.style.width = `${menuWidth}px`;
    }

    refreshHeaderList() {
        this.headerList.innerHTML = '';

        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) return;

        const editor = this.app.workspace.activeLeaf?.view?.sourceMode?.cmEditor;
        if (!editor) return;

        const doc = editor.getDoc();
        const lines = doc.getValue().split('\n');

        lines.forEach((line, index) => {
            const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
            if (headerMatch) {
                const level = headerMatch[1].length;
                if ((level === 1 && !this.settings.showH1) ||
                    (level === 2 && !this.settings.showH2) ||
                    (level === 3 && !this.settings.showH3) ||
                    level > 3) {
                    return;
                }

                const headerText = headerMatch[2];
                const headerItem = document.createElement('div');
                headerItem.innerText = headerText;
                headerItem.dataset.line = index;

                Object.assign(headerItem.style, {
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontFamily: 'Fira Code, monospace',
                    color: 'var(--text-muted)',
                    padding: '6px 0',
                    textAlign: 'center',
                    backgroundColor: 'transparent',
                    transition: 'color 0.2s ease',
                    paddingLeft: `${(level - 1) * 12}px` // may change this in futrure...
                });

                headerItem.addEventListener('click', () => this.navigateToHeader(headerText));
                headerItem.addEventListener('mouseover', () => headerItem.style.color = 'var(--interactive-accent)');
                headerItem.addEventListener('mouseout', () => headerItem.style.color = 'var(--text-muted)');

                this.headerList.appendChild(headerItem);
            }
        });
    }

    scrollToTop() {
        this.app.workspace.activeLeaf?.view?.sourceMode?.cmEditor?.scrollTo(0, 0);
    }

    navigateToHeader(headerText) {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
            this.app.workspace.openLinkText(`${activeFile.basename}#${headerText}`, '', false);
        }
    }
}

class BackToTopSettingsTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Enable Header Menu')
            .setDesc('Show a list of headers above the Back to Top button.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableHeaderMenu)
                .onChange(async (value) => {
                    this.plugin.settings.enableHeaderMenu = value;

                    if (!value) {
                        // Store previous state and disable individual header toggles
                        this.plugin.settings.previousShowH1 = this.plugin.settings.showH1;
                        this.plugin.settings.previousShowH2 = this.plugin.settings.showH2;
                        this.plugin.settings.previousShowH3 = this.plugin.settings.showH3;

                        this.plugin.settings.showH1 = false;
                        this.plugin.settings.showH2 = false;
                        this.plugin.settings.showH3 = false;
                    } else {
                        // Restore previous state (if available), otherwise default all to true
                        this.plugin.settings.showH1 = this.plugin.settings.previousShowH1 ?? true;
                        this.plugin.settings.showH2 = this.plugin.settings.previousShowH2 ?? true;
                        this.plugin.settings.showH3 = this.plugin.settings.previousShowH3 ?? true;
                    }

                    await this.plugin.saveSettings();
                    this.plugin.updateMenu();

                    // ⚠️ Important — Rebuild the settings UI so the toggles reflect new state
                    this.display();
                }));

        // Individual H1-H3 toggles (only shown if the menu is enabled)
        if (this.plugin.settings.enableHeaderMenu) {
            ['H1', 'H2', 'H3'].forEach(level => {
                new Setting(containerEl)
                    .setName(`Show ${level}`)
                    .setDesc(`Show ${level} headings in the list.`)
                    .addToggle(toggle => toggle
                        .setValue(this.plugin.settings[`show${level}`])
                        .onChange(async (value) => {
                            this.plugin.settings[`show${level}`] = value;

                            // Enabling any tier should also enable the menu
                            if (value) this.plugin.settings.enableHeaderMenu = true;

                            await this.plugin.saveSettings();
                            this.plugin.updateMenu();

                            // Rebuild to make sure the main toggle is properly checked if needed
                            this.display();
                        }));
            });
        }
    }
}



module.exports = BackToTopPlugin;
