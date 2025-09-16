import { MarkdownPostProcessorContext } from 'obsidian';

interface MusicBlockConfig {
	track: string;
	name?: string;
	volume?: number;
	loop?: boolean;
	fadeIn?: number;
	fadeOut?: number;
	description?: string;
	autoplay?: boolean;
}

interface MusicTrack {
	path: string;
	name: string;
	duration?: number;
	volume?: number;
	source?: 'frontmatter' | 'rule' | 'music-block' | 'default';
	fadeIn?: number;
	loop?: boolean;
}

export class MusicBlockProcessor {
	private activeMusicBlocks: Map<HTMLElement, MusicBlockConfig> = new Map();
	private scrollObserver: IntersectionObserver | null = null;
	private settings: any;
	private audioEngine: any;
	private plugin: any;

	constructor(plugin: any, settings: any, audioEngine: any) {
		this.plugin = plugin;
		this.settings = settings;
		this.audioEngine = audioEngine;
	}

	setupProcessor(): void {
		if (!this.settings.musicBlockEnabled) {
			return;
		}

		this.plugin.registerMarkdownCodeBlockProcessor('music', (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			this.processMusicBlock(source, el, ctx);
		});

		this.setupScrollObserver();
	}

	private processMusicBlock(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
		try {
			// 解析 JSON 配置
			const config: MusicBlockConfig = JSON.parse(source);
			
			// 验证必需字段
			if (!config.track) {
				const errorDiv = document.createElement('div');
				errorDiv.className = 'music-block-error';
				errorDiv.textContent = '❌ 错误：缺少 track 字段';
				el.appendChild(errorDiv);
				return;
			}

			// 创建音乐块元素
			const musicBlock = document.createElement('div');
			musicBlock.className = 'music-block';
			musicBlock.setAttribute('data-music-block', 'true');
			el.appendChild(musicBlock);
			
			// 存储配置
			this.activeMusicBlocks.set(musicBlock, config);

			// 创建音乐块内容
			const header = document.createElement('div');
			header.className = 'music-block-header';
			musicBlock.appendChild(header);

			const icon = document.createElement('span');
			icon.className = 'music-block-icon';
			icon.textContent = '🎵';
			header.appendChild(icon);

			const title = document.createElement('span');
			title.className = 'music-block-title';
			title.textContent = config.name || this.extractTrackName(config.track);
			header.appendChild(title);

			if (config.description) {
				const description = document.createElement('div');
				description.className = 'music-block-description';
				description.textContent = config.description;
				musicBlock.appendChild(description);
			}

			// 显示配置信息
			const info = document.createElement('div');
			info.className = 'music-block-info';
			musicBlock.appendChild(info);

			const trackInfo = document.createElement('span');
			trackInfo.textContent = `🎼 ${config.track}`;
			info.appendChild(trackInfo);
			
			if (config.volume !== undefined) {
				const volumeInfo = document.createElement('span');
				volumeInfo.textContent = ` | 🔊 ${Math.round(config.volume * 100)}%`;
				info.appendChild(volumeInfo);
			}
			
			if (config.loop) {
				const loopInfo = document.createElement('span');
				loopInfo.textContent = ' | 🔄 循环播放';
				info.appendChild(loopInfo);
			}

			// 手动播放按钮
			const controls = document.createElement('div');
			controls.className = 'music-block-controls';
			musicBlock.appendChild(controls);

			const playButton = document.createElement('button');
			playButton.className = 'music-block-play-btn';
			playButton.textContent = '▶️ 手动播放';
			controls.appendChild(playButton);
			
			playButton.addEventListener('click', () => {
				this.playMusicBlock(config);
			});

			// 如果观察器已创建，立即开始观察这个元素
			if (this.scrollObserver) {
				this.scrollObserver.observe(musicBlock);
			}

			console.log('Created music block:', config);

		} catch (error) {
			console.error('Error parsing music block:', error);
			const errorDiv = document.createElement('div');
			errorDiv.className = 'music-block-error';
			errorDiv.textContent = `❌ JSON 解析错误: ${error.message}`;
			el.appendChild(errorDiv);
		}
	}

	private setupScrollObserver(): void {
		if (!this.settings.musicBlockEnabled) {
			return;
		}

		// 创建 Intersection Observer 来监听音乐块的可见性
		this.scrollObserver = new IntersectionObserver((entries) => {
			entries.forEach(entry => {
				const musicBlock = entry.target as HTMLElement;
				const config = this.activeMusicBlocks.get(musicBlock);
				
				if (config && entry.isIntersecting) {
					// 元素进入视口，播放音乐
					console.log('Music block entered viewport:', config);
					this.playMusicBlock(config);
					
					// 添加视觉反馈
					musicBlock.classList.add('music-block-playing');
				} else if (config) {
					// 元素离开视口
					musicBlock.classList.remove('music-block-playing');
				}
			});
		}, {
			rootMargin: `${this.settings.musicBlockTriggerOffset || 100}px 0px`,
			threshold: 0.1
		});

		// 观察页面中所有现有的音乐块
		this.observeExistingMusicBlocks();
	}

	private observeExistingMusicBlocks(): void {
		if (!this.scrollObserver) return;

		// 查找页面中所有的音乐块并开始观察
		const musicBlocks = document.querySelectorAll('[data-music-block="true"]');
		musicBlocks.forEach(block => {
			this.scrollObserver?.observe(block);
		});
	}

	private async playMusicBlock(config: MusicBlockConfig): Promise<void> {
		const track: MusicTrack = {
			path: config.track,
			name: config.name || this.extractTrackName(config.track),
			volume: config.volume || this.settings.defaultVolume,
			source: 'music-block',
			fadeIn: config.fadeIn || 0,
			loop: config.loop !== false // 默认循环播放
		};

		console.log('Playing music block:', track);
		await this.audioEngine.play(track);
		
		// 更新状态栏
		if (this.plugin.updateStatusBar) {
			this.plugin.updateStatusBar();
		}
	}

	private extractTrackName(path: string): string {
		return path.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Unknown Track';
	}

	destroy(): void {
		if (this.scrollObserver) {
			this.scrollObserver.disconnect();
			this.scrollObserver = null;
		}
		this.activeMusicBlocks.clear();
	}

	// 公共方法：重新观察音乐块（当页面内容变化时调用）
	refreshObserver(): void {
		if (this.scrollObserver) {
			this.observeExistingMusicBlocks();
		}
	}
} 