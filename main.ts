import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, WorkspaceLeaf, MarkdownPostProcessorContext } from 'obsidian';
import { MusicBlockProcessor } from './music-block-processor';
import { AdvancedAudioEngine, AudioTrack } from './advanced-audio-engine';

// ===================== 类型定义 =====================

interface MusicPlayerSettings {
	musicFolder: string;
	defaultVolume: number;
	autoplay: boolean;
	crossfadeTime: number;
	musicRules: MusicRule[];
	frontmatterEnabled: boolean;
	frontmatterProperty: string;
	frontmatterPriority: boolean;
	musicBlockEnabled: boolean;
	musicBlockTriggerOffset: number;
}

interface MusicRule {
	id: string;
	name: string;
	trigger: 'file-path' | 'file-tag' | 'section-header' | 'file-extension';
	pattern: string;
	musicPath: string;
	priority: number;
	enabled: boolean;
}

interface PlaybackContext {
	currentFile?: TFile;
	currentSection?: string;
	cursorLine?: number;
	workspaceLayout?: string;
	frontmatterMusic?: string;
}

interface MusicTrack extends AudioTrack {
	duration?: number;
	source?: 'frontmatter' | 'rule' | 'music-block' | 'default';
}

// ===================== 默认设置 =====================

const DEFAULT_SETTINGS: MusicPlayerSettings = {
	musicFolder: '',
	defaultVolume: 0.7,
	autoplay: true,
	crossfadeTime: 2000,
	frontmatterEnabled: true,
	frontmatterProperty: 'music',
	frontmatterPriority: true,
	musicBlockEnabled: true,
	musicBlockTriggerOffset: 100,
	musicRules: [
		{
			id: 'default-rule',
			name: 'Markdown files - Ambient',
			trigger: 'file-extension',
			pattern: 'md',
			musicPath: '',
			priority: 1,
			enabled: true
		}
	]
};



// ===================== 音乐规则引擎 =====================

class MusicRuleEngine {
	private rules: MusicRule[] = [];

	constructor(rules: MusicRule[] = []) {
		this.rules = rules.sort((a, b) => b.priority - a.priority);
	}

	updateRules(rules: MusicRule[]): void {
		this.rules = rules.filter(r => r.enabled).sort((a, b) => b.priority - a.priority);
	}

	findMatchingMusic(context: PlaybackContext): string | null {
		for (const rule of this.rules) {
			if (!rule.enabled || !rule.musicPath) continue;

			let matches = false;
			
			switch (rule.trigger) {
				case 'file-path':
					if (context.currentFile?.path) {
						matches = new RegExp(rule.pattern, 'i').test(context.currentFile.path);
					}
					break;
					
				case 'file-extension':
					if (context.currentFile?.extension) {
						matches = context.currentFile.extension === rule.pattern;
					}
					break;
					
				case 'file-tag':
					// TODO: 实现基于标签的匹配
					break;
					
				case 'section-header':
					if (context.currentSection) {
						matches = new RegExp(rule.pattern, 'i').test(context.currentSection);
					}
					break;
			}

			if (matches) {
				return rule.musicPath;
			}
		}
		
		return null;
	}
}

// ===================== 主插件类 =====================

export default class GlobalMusicPlayer extends Plugin {
	settings: MusicPlayerSettings;
	audioEngine: AdvancedAudioEngine;
	ruleEngine: MusicRuleEngine;
	statusBarItem: HTMLElement;
	private debounceTimer: number | null = null;
	private musicBlockProcessor: MusicBlockProcessor | null = null;
	private progressBarContainer: HTMLElement | null = null;
	private progressBarElement: HTMLElement | null = null;
	private progressUpdateInterval: number | null = null;
	
	async onload() {
		await this.loadSettings();
		
		// 初始化组件
		this.audioEngine = new AdvancedAudioEngine(this.app, this.settings.defaultVolume);
		this.ruleEngine = new MusicRuleEngine(this.settings.musicRules);
		
		// 创建状态栏项目
		this.setupStatusBar();
		
		// 注册事件监听器
		this.registerEvents();
		
		// 添加命令
		this.addCommands();
		
		// 添加设置面板
		this.addSettingTab(new MusicPlayerSettingTab(this.app, this));
		
		// 初始化音乐块处理器
		console.log('🎵 Initializing music block processor...');
		this.musicBlockProcessor = new MusicBlockProcessor(this, this.settings, this.audioEngine);
		this.musicBlockProcessor.setupProcessor();
		console.log('🎵 Music block processor initialized');
		
		// 测试音乐块处理器是否正常工作
		console.log('🎵 Testing music block processor setup...');
		console.log('🎵 Music block enabled:', this.settings.musicBlockEnabled);
		console.log('🎵 Music block processor instance:', !!this.musicBlockProcessor);
		
		console.log('Global Music Player loaded');
	}

	onunload() {
		if (this.debounceTimer) {
			window.clearTimeout(this.debounceTimer);
		}
		if (this.musicBlockProcessor) {
			this.musicBlockProcessor.destroy();
		}
		this.hideProgressBar();
		this.audioEngine.stop();
		console.log('Global Music Player unloaded');
	}

	private setupStatusBar(): void {
		this.statusBarItem = this.addStatusBarItem();
		this.updateStatusBar();
		
		// 点击状态栏切换播放/暂停
		this.statusBarItem.addEventListener('click', (e) => {
			e.preventDefault();
			if (e.shiftKey) {
				// Shift+点击显示进度条
				this.toggleProgressBar();
			} else {
				// 普通点击播放/暂停
				if (this.audioEngine.isCurrentlyPlaying()) {
					this.audioEngine.pause();
				} else {
					this.audioEngine.resume();
				}
				this.updateStatusBar();
			}
		});
	}

	private updateStatusBar(): void {
		const currentTrack = this.audioEngine.getCurrentTrack();
		const isPlaying = this.audioEngine.isCurrentlyPlaying();
		
		if (currentTrack) {
			const icon = isPlaying ? '⏸️' : '▶️';
			const sourceIcon = this.getSourceIcon(currentTrack.source);
			this.statusBarItem.setText(`${icon}${sourceIcon} ${currentTrack.name}`);
		} else {
			this.statusBarItem.setText('🎵 No music');
		}
	}

	private getSourceIcon(source?: 'frontmatter' | 'rule' | 'music-block' | 'default'): string {
		switch (source) {
			case 'frontmatter': return '🎵'; // 表示来自文件frontmatter
			case 'rule': return '⚙️'; // 表示来自规则
			case 'music-block': return '🎶'; // 表示来自音乐块
			default: return '🎵'; // 默认
		}
	}

	private toggleProgressBar(): void {
		if (this.progressBarContainer) {
			// 隐藏进度条
			this.hideProgressBar();
		} else {
			// 显示进度条
			this.showProgressBar();
		}
	}

	private showProgressBar(): void {
		if (this.progressBarContainer) return;

		// 创建进度条容器
		this.progressBarContainer = document.createElement('div');
		this.progressBarContainer.className = 'music-progress-container';
		
		// 创建进度条背景
		const progressBackground = this.progressBarContainer.createEl('div', {
			cls: 'music-progress-background'
		});

		// 创建进度条
		this.progressBarElement = progressBackground.createEl('div', {
			cls: 'music-progress-bar'
		});

		// 创建时间显示
		const timeDisplay = this.progressBarContainer.createEl('div', {
			cls: 'music-time-display'
		});

		// 创建控制按钮
		const controlsContainer = this.progressBarContainer.createEl('div', {
			cls: 'music-controls'
		});

		// 播放速度控制
		const speedControl = controlsContainer.createEl('select', {
			cls: 'music-speed-control'
		});
		
		const speeds = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
		speeds.forEach(speed => {
			const option = speedControl.createEl('option', {
				value: speed.toString(),
				text: `${speed}x`
			});
			if (speed === 1.0) option.selected = true;
		});

		speedControl.addEventListener('change', () => {
			const rate = parseFloat(speedControl.value);
			this.audioEngine.setPlaybackRate(rate);
		});

		// 添加到状态栏下方
		const statusBarEl = document.querySelector('.status-bar');
		if (statusBarEl) {
			statusBarEl.appendChild(this.progressBarContainer);
		}

		// 进度条点击事件
		progressBackground.addEventListener('click', (e) => {
			const rect = progressBackground.getBoundingClientRect();
			const clickX = e.clientX - rect.left;
			const percentage = clickX / rect.width;
			const duration = this.audioEngine.getDuration();
			const newTime = duration * percentage;
			this.audioEngine.setCurrentTime(newTime);
		});

		// 开始更新进度条
		this.startProgressUpdate();
	}

	private hideProgressBar(): void {
		if (this.progressBarContainer) {
			this.progressBarContainer.remove();
			this.progressBarContainer = null;
			this.progressBarElement = null;
		}
		
		if (this.progressUpdateInterval) {
			clearInterval(this.progressUpdateInterval);
			this.progressUpdateInterval = null;
		}
	}

	private startProgressUpdate(): void {
		if (this.progressUpdateInterval) {
			clearInterval(this.progressUpdateInterval);
		}

		this.progressUpdateInterval = window.setInterval(() => {
			if (!this.progressBarElement || !this.progressBarContainer) return;

			const currentTime = this.audioEngine.getCurrentTime();
			const duration = this.audioEngine.getDuration();
			
			if (duration > 0) {
				const percentage = (currentTime / duration) * 100;
				this.progressBarElement.style.width = `${percentage}%`;
				
				// 更新时间显示
				const timeDisplay = this.progressBarContainer.querySelector('.music-time-display');
				if (timeDisplay) {
					const currentMin = Math.floor(currentTime / 60);
					const currentSec = Math.floor(currentTime % 60);
					const durationMin = Math.floor(duration / 60);
					const durationSec = Math.floor(duration % 60);
					timeDisplay.textContent = `${currentMin}:${currentSec.toString().padStart(2, '0')} / ${durationMin}:${durationSec.toString().padStart(2, '0')}`;
				}
			}
		}, 100);
	}

	private registerEvents(): void {
		// 监听文件切换
		this.registerEvent(
			this.app.workspace.on('file-open', (file: TFile | null) => {
				this.debouncedHandleFileChange(file);
			})
		);

		// 监听活动叶子变化
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', (leaf: WorkspaceLeaf | null) => {
				if (leaf?.view instanceof MarkdownView) {
					const file = leaf.view.file;
					this.debouncedHandleFileChange(file);
				}
			})
		);
	}

	private debouncedHandleFileChange(file: TFile | null): void {
		// 清除之前的定时器
		if (this.debounceTimer) {
			window.clearTimeout(this.debounceTimer);
		}
		
		// 设置新的定时器，300ms 防抖
		this.debounceTimer = window.setTimeout(() => {
			if (file && this.settings.autoplay) {
				this.handleFileChange(file);
			}
		}, 300);
	}

	private async getFrontmatterMusic(file: TFile): Promise<string | null> {
		if (!this.settings.frontmatterEnabled) {
			return null;
		}

		try {
			// 读取文件的 metadata cache
			const fileCache = this.app.metadataCache.getFileCache(file);
			if (!fileCache || !fileCache.frontmatter) {
				return null;
			}

			const frontmatter = fileCache.frontmatter;
			const musicProperty = this.settings.frontmatterProperty;
			
			// 支持多种属性名称
			const possibleProperties = [
				musicProperty,
				'background-music',
				'bgm',
				'audio',
				'soundtrack'
			];

			for (const prop of possibleProperties) {
				if (frontmatter[prop]) {
					const musicPath = frontmatter[prop];
					console.log(`Found frontmatter music: ${prop} = ${musicPath}`);
					return musicPath;
				}
			}

			return null;
		} catch (error) {
			console.error('Error reading frontmatter:', error);
			return null;
		}
	}

	private async handleFileChange(file: TFile): Promise<void> {
		const context: PlaybackContext = {
			currentFile: file,
			workspaceLayout: 'default'
		};

		let musicPath: string | null = null;
		let source: 'frontmatter' | 'rule' | 'default' = 'default';

		// 1. 首先尝试从 frontmatter 获取音乐
		if (this.settings.frontmatterEnabled) {
			const frontmatterMusic = await this.getFrontmatterMusic(file);
			if (frontmatterMusic) {
				musicPath = frontmatterMusic;
				source = 'frontmatter';
				context.frontmatterMusic = frontmatterMusic;
			}
		}

		// 2. 如果没有 frontmatter 音乐，或者规则优先级更高，则使用规则
		if (!musicPath || !this.settings.frontmatterPriority) {
			const ruleMusicPath = this.ruleEngine.findMatchingMusic(context);
			if (ruleMusicPath) {
				// 如果 frontmatter 优先级更高，只有在没有 frontmatter 音乐时才使用规则
				if (!musicPath || !this.settings.frontmatterPriority) {
					musicPath = ruleMusicPath;
					source = 'rule';
				}
			}
		}
		
		if (musicPath) {
			const track: MusicTrack = {
				path: musicPath,
				name: this.extractTrackName(musicPath),
				source: source,
				type: 'bgm' // 默认作为背景音乐
			};
			
			console.log(`Playing music from ${source}: ${musicPath}`);
			await this.audioEngine.playBGM(track);
			this.updateStatusBar();
		} else {
			console.log('No music found for this file');
			this.audioEngine.stopAll();
			this.updateStatusBar();
		}
	}

	private extractTrackName(path: string): string {
		return path.split('/').pop()?.split('.')[0] || 'Unknown Track';
	}

	private addCommands(): void {
		// 播放/暂停命令
		this.addCommand({
			id: 'toggle-playback',
			name: 'Toggle music playback',
			callback: () => {
				if (this.audioEngine.isCurrentlyPlaying()) {
					this.audioEngine.pause();
				} else {
					this.audioEngine.resume();
				}
				this.updateStatusBar();
			}
		});

		// 停止播放命令
		this.addCommand({
			id: 'stop-playback',
			name: 'Stop music playback',
			callback: () => {
				this.audioEngine.stop();
				this.updateStatusBar();
			}
		});

		// 音量控制命令
		this.addCommand({
			id: 'volume-up',
			name: 'Volume up',
			callback: () => {
				const newVolume = Math.min(1, this.audioEngine.getVolume() + 0.1);
				this.audioEngine.setVolume(newVolume);
				new Notice(`Volume: ${Math.round(newVolume * 100)}%`);
			}
		});

		this.addCommand({
			id: 'volume-down',
			name: 'Volume down',
			callback: () => {
				const newVolume = Math.max(0, this.audioEngine.getVolume() - .1);
				this.audioEngine.setVolume(newVolume);
				new Notice(`Volume: ${Math.round(newVolume * 100)}%`);
			}
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// 更新规则引擎
		this.ruleEngine?.updateRules(this.settings.musicRules);
		// 更新音频引擎设置
		this.audioEngine?.setVolume(this.settings.defaultVolume);
	}
}

// ===================== 设置面板 =====================

class MusicPlayerSettingTab extends PluginSettingTab {
	plugin: GlobalMusicPlayer;

	constructor(app: App, plugin: GlobalMusicPlayer) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Global Music Player Settings' });

		// 音乐文件夹设置
		new Setting(containerEl)
			.setName('Music folder')
			.setDesc('Path to your music folder (relative to vault or absolute path)')
			.addText(text => text
				.setPlaceholder('music/')
				.setValue(this.plugin.settings.musicFolder)
				.onChange(async (value) => {
					this.plugin.settings.musicFolder = value;
					await this.plugin.saveSettings();
				}));

		// 默认音量设置
		new Setting(containerEl)
			.setName('Default volume')
			.setDesc('Default playback volume (0-100%)')
			.addSlider(slider => slider
				.setLimits(0, 100, 5)
				.setValue(this.plugin.settings.defaultVolume * 100)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.defaultVolume = value / 100;
					await this.plugin.saveSettings();
				}));

		// 自动播放设置
		new Setting(containerEl)
			.setName('Auto-play')
			.setDesc('Automatically play music when switching files')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoplay)
				.onChange(async (value) => {
					this.plugin.settings.autoplay = value;
					await this.plugin.saveSettings();
				}));

		// 渐变时间设置
		new Setting(containerEl)
			.setName('Crossfade time')
			.setDesc('Time in milliseconds for crossfade between tracks')
			.addText(text => text
				.setPlaceholder('2000')
				.setValue(this.plugin.settings.crossfadeTime.toString())
				.onChange(async (value) => {
					const time = parseInt(value) || 2000;
					this.plugin.settings.crossfadeTime = time;
					await this.plugin.saveSettings();
				}));

		// Frontmatter 音乐部分
		containerEl.createEl('h3', { text: 'Frontmatter Music' });
		containerEl.createEl('p', { 
			text: 'Allow files to specify their own music through frontmatter properties.',
			cls: 'setting-item-description'
		});

		// 启用 frontmatter 音乐
		new Setting(containerEl)
			.setName('Enable frontmatter music')
			.setDesc('Allow files to specify music through frontmatter properties')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.frontmatterEnabled)
				.onChange(async (value) => {
					this.plugin.settings.frontmatterEnabled = value;
					await this.plugin.saveSettings();
				}));

		// Frontmatter 属性名称
		new Setting(containerEl)
			.setName('Frontmatter property')
			.setDesc('Primary property name to read music path from (also supports: background-music, bgm, audio, soundtrack)')
			.addText(text => text
				.setPlaceholder('music')
				.setValue(this.plugin.settings.frontmatterProperty)
				.onChange(async (value) => {
					this.plugin.settings.frontmatterProperty = value || 'music';
					await this.plugin.saveSettings();
				}));

		// Frontmatter 优先级
		new Setting(containerEl)
			.setName('Frontmatter priority')
			.setDesc('When enabled, frontmatter music takes priority over rules. When disabled, rules can override frontmatter.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.frontmatterPriority)
				.onChange(async (value) => {
					this.plugin.settings.frontmatterPriority = value;
					await this.plugin.saveSettings();
				}));

		// 音乐规则部分
		containerEl.createEl('h3', { text: 'Music Rules' });
		containerEl.createEl('p', { 
			text: 'Configure when and what music to play based on file patterns.',
			cls: 'setting-item-description'
		});

		// TODO: 添加规则管理界面
		this.displayMusicRules(containerEl);
	}

	private displayMusicRules(containerEl: HTMLElement): void {
		const rulesContainer = containerEl.createEl('div', { cls: 'music-rules-container' });
		
		this.plugin.settings.musicRules.forEach((rule, index) => {
			const ruleEl = rulesContainer.createEl('div', { cls: 'music-rule-item' });
			
			new Setting(ruleEl)
				.setName(rule.name || `Rule ${index + 1}`)
				.setDesc(`${rule.trigger}: ${rule.pattern} → ${rule.musicPath || 'No music set'}`)
				.addToggle(toggle => toggle
					.setValue(rule.enabled)
					.onChange(async (value) => {
						this.plugin.settings.musicRules[index].enabled = value;
						await this.plugin.saveSettings();
					}))
				.addButton(button => button
					.setButtonText('Edit')
					.onClick(() => {
						new RuleEditModal(this.app, rule, (updatedRule) => {
							this.plugin.settings.musicRules[index] = updatedRule;
							this.plugin.saveSettings();
							this.display(); // 重新渲染设置页面
						}).open();
					}))
				.addButton(button => button
					.setButtonText('Delete')
					.setWarning()
					.onClick(async () => {
						this.plugin.settings.musicRules.splice(index, 1);
						await this.plugin.saveSettings();
						this.display(); // 重新渲染
					}));
		});

		// 添加新规则按钮
		new Setting(rulesContainer)
			.addButton(button => button
				.setButtonText('Add new rule')
				.setCta()
				.onClick(() => {
					const newRule: MusicRule = {
						id: Date.now().toString(),
						name: 'New Rule',
						trigger: 'file-extension',
						pattern: 'md',
						musicPath: '',
						priority: 1,
						enabled: true
					};
					this.plugin.settings.musicRules.push(newRule);
					this.plugin.saveSettings();
					this.display(); // 重新渲染
				}));
	}
}

// ===================== 规则编辑模态对话框 =====================

class RuleEditModal extends Modal {
	rule: MusicRule;
	onSave: (rule: MusicRule) => void;

	constructor(app: App, rule: MusicRule, onSave: (rule: MusicRule) => void) {
		super(app);
		this.rule = { ...rule }; // 创建副本以避免直接修改原对象
		this.onSave = onSave;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Edit Music Rule' });

		// 规则名称
		new Setting(contentEl)
			.setName('Rule name')
			.setDesc('A descriptive name for this rule')
			.addText(text => text
				.setPlaceholder('My Music Rule')
				.setValue(this.rule.name)
				.onChange((value) => {
					this.rule.name = value;
				}));

		// 触发条件
		new Setting(contentEl)
			.setName('Trigger type')
			.setDesc('When should this rule be activated?')
			.addDropdown(dropdown => dropdown
				.addOption('file-extension', 'File Extension')
				.addOption('file-path', 'File Path (regex)')
				.addOption('file-tag', 'File Tag')
				.addOption('section-header', 'Section Header (regex)')
				.setValue(this.rule.trigger)
				.onChange((value: 'file-extension' | 'file-path' | 'file-tag' | 'section-header') => {
					this.rule.trigger = value;
					this.updatePatternDescription();
				}));

		// 模式输入
		const patternSetting = new Setting(contentEl)
			.setName('Pattern')
			.addText(text => text
				.setPlaceholder('md')
				.setValue(this.rule.pattern)
				.onChange((value) => {
					this.rule.pattern = value;
				}));

		// 动态更新模式描述
		const updatePatternDescription = () => {
			let desc = '';
			switch (this.rule.trigger) {
				case 'file-extension':
					desc = 'File extension (e.g., "md", "txt")';
					break;
				case 'file-path':
					desc = 'Regular expression to match file paths';
					break;
				case 'file-tag':
					desc = 'Tag name to match';
					break;
				case 'section-header':
					desc = 'Regular expression to match section headers';
					break;
			}
			patternSetting.setDesc(desc);
		};
		updatePatternDescription();
		this.updatePatternDescription = updatePatternDescription;

		// 音乐路径
		new Setting(contentEl)
			.setName('Music path')
			.setDesc('Path to music file (local path like "music/ambient.mp3" or URL)')
			.addText(text => text
				.setPlaceholder('music/ambient.mp3')
				.setValue(this.rule.musicPath)
				.onChange((value) => {
					this.rule.musicPath = value;
				}));

		// 优先级
		new Setting(contentEl)
			.setName('Priority')
			.setDesc('Higher numbers have higher priority (1-10)')
			.addSlider(slider => slider
				.setLimits(1, 10, 1)
				.setValue(this.rule.priority)
				.setDynamicTooltip()
				.onChange((value) => {
					this.rule.priority = value;
				}));

		// 启用开关
		new Setting(contentEl)
			.setName('Enabled')
			.setDesc('Whether this rule is active')
			.addToggle(toggle => toggle
				.setValue(this.rule.enabled)
				.onChange((value) => {
					this.rule.enabled = value;
				}));

		// 按钮
		const buttonContainer = contentEl.createEl('div', { 
			cls: 'modal-button-container',
			attr: { style: 'display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;' }
		});

		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => {
			this.close();
		});

		const saveButton = buttonContainer.createEl('button', { 
			text: 'Save',
			cls: 'mod-cta'
		});
		saveButton.addEventListener('click', () => {
			this.onSave(this.rule);
			this.close();
		});
	}

	updatePatternDescription: () => void;

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}