import { App, TFile } from 'obsidian';

export interface AudioTrack {
	path: string;
	name: string;
	volume?: number;
	loop?: boolean;
	fadeIn?: number;
	fadeOut?: number;
	type?: 'bgm' | 'sfx'; // 背景音乐或音效
	priority?: number; // 音效优先级
	source?: 'frontmatter' | 'rule' | 'music-block' | 'default'; // 音频来源
}

interface AudioInstance {
	audio: HTMLAudioElement;
	track: AudioTrack;
	fadeInterval?: any; // 使用any来兼容不同环境的Timer类型
	targetVolume: number;
	currentVolume: number;
	type: 'bgm' | 'sfx';
}

export class AdvancedAudioEngine {
	private app: App;
	private globalVolume: number = 0.7;
	private bgmInstance: AudioInstance | null = null;
	private sfxInstances: Map<string, AudioInstance> = new Map();
	private fadeSteps: number = 100; // 增加渐变步数以获得更平滑的效果
	private fadeInterval: number = 16; // 使用 60fps 的间隔 (16.67ms)

	constructor(app: App, volume: number = 0.7) {
		this.app = app;
		this.globalVolume = volume;
	}

	// 播放背景音乐（会替换当前BGM）
	async playBGM(track: AudioTrack): Promise<void> {
		console.log('🎵 Playing BGM:', track.name);
		
		// 如果有当前BGM，先淡出
		if (this.bgmInstance) {
			await this.fadeOut(this.bgmInstance, track.fadeOut || 1000);
			this.stopAudio(this.bgmInstance);
		}

		// 创建新的BGM实例
		const resolvedPath = await this.resolveAudioPath(track.path);
		const audio = new Audio(resolvedPath);
		
		const instance: AudioInstance = {
			audio,
			track: { ...track, type: 'bgm' },
			targetVolume: track.volume || this.globalVolume,
			currentVolume: 0,
			type: 'bgm'
		};

		// 设置音频属性
		audio.loop = track.loop !== false;
		audio.volume = 0; // 从0开始淡入

		// 设置事件监听
		this.setupAudioEvents(instance);

		// 播放并淡入
		await audio.play();
		this.bgmInstance = instance;
		
		if (track.fadeIn && track.fadeIn > 0) {
			await this.fadeIn(instance, track.fadeIn);
		} else {
			audio.volume = instance.targetVolume;
			instance.currentVolume = instance.targetVolume;
		}
	}

	// 播放音效（叠加在BGM上）
	async playSFX(track: AudioTrack): Promise<void> {
		console.log('🎵 Playing SFX:', track.name);
		
		const resolvedPath = await this.resolveAudioPath(track.path);
		const audio = new Audio(resolvedPath);
		
		const sfxId = `${track.path}_${Date.now()}`;
		const instance: AudioInstance = {
			audio,
			track: { ...track, type: 'sfx' },
			targetVolume: track.volume || this.globalVolume,
			currentVolume: 0,
			type: 'sfx'
		};

		// 设置音频属性
		audio.loop = track.loop || false; // 音效默认不循环
		audio.volume = 0;

		// 音效播放完成后自动清理
		audio.addEventListener('ended', () => {
			this.sfxInstances.delete(sfxId);
			console.log('🎵 SFX ended and cleaned up:', track.name);
		});

		this.setupAudioEvents(instance);

		// 播放并淡入
		await audio.play();
		this.sfxInstances.set(sfxId, instance);

		if (track.fadeIn && track.fadeIn > 0) {
			await this.fadeIn(instance, track.fadeIn);
		} else {
			audio.volume = instance.targetVolume;
			instance.currentVolume = instance.targetVolume;
		}
	}

	// 停止所有音频
	stopAll(): void {
		if (this.bgmInstance) {
			this.stopAudio(this.bgmInstance);
			this.bgmInstance = null;
		}
		
		this.sfxInstances.forEach(instance => {
			this.stopAudio(instance);
		});
		this.sfxInstances.clear();
	}

	// 停止BGM
	async stopBGM(fadeOutTime?: number): Promise<void> {
		if (!this.bgmInstance) return;

		if (fadeOutTime && fadeOutTime > 0) {
			await this.fadeOut(this.bgmInstance, fadeOutTime);
		}
		
		this.stopAudio(this.bgmInstance);
		this.bgmInstance = null;
	}

	// 停止所有音效
	stopAllSFX(): void {
		this.sfxInstances.forEach(instance => {
			this.stopAudio(instance);
		});
		this.sfxInstances.clear();
	}

	// 淡入效果 - 使用平滑的指数曲线
	private async fadeIn(instance: AudioInstance, duration: number): Promise<void> {
		return new Promise((resolve) => {
			const startTime = Date.now();
			const startVolume = instance.currentVolume;
			const targetVolume = instance.targetVolume;
			
			const updateVolume = () => {
				const elapsed = Date.now() - startTime;
				const progress = Math.min(elapsed / duration, 1);
				
				// 使用 ease-in-out 曲线获得更自然的声音过渡
				const easedProgress = this.easeInOutQuad(progress);
				const newVolume = startVolume + (targetVolume - startVolume) * easedProgress;
				
				// 使用更精确的音量控制，避免数字失真
				const roundedVolume = Math.round(newVolume * 1000) / 1000;
				instance.audio.volume = roundedVolume;
				instance.currentVolume = roundedVolume;

				if (progress >= 1) {
					instance.audio.volume = targetVolume;
					instance.currentVolume = targetVolume;
					if (instance.fadeInterval) {
						clearInterval(instance.fadeInterval);
						instance.fadeInterval = undefined;
					}
					resolve();
				}
			};

			// 使用 requestAnimationFrame 或固定间隔
			const fadeInterval = setInterval(updateVolume, this.fadeInterval);
			instance.fadeInterval = fadeInterval;
		});
	}

	// 淡出效果 - 使用平滑的指数曲线
	private async fadeOut(instance: AudioInstance, duration: number): Promise<void> {
		return new Promise((resolve) => {
			const startTime = Date.now();
			const startVolume = instance.currentVolume;
			
			const updateVolume = () => {
				const elapsed = Date.now() - startTime;
				const progress = Math.min(elapsed / duration, 1);
				
				// 使用 ease-in-out 曲线获得更自然的声音过渡
				const easedProgress = this.easeInOutQuad(progress);
				const newVolume = startVolume * (1 - easedProgress);
				
				// 使用更精确的音量控制，避免数字失真
				const roundedVolume = Math.max(Math.round(newVolume * 1000) / 1000, 0);
				instance.audio.volume = roundedVolume;
				instance.currentVolume = roundedVolume;

				if (progress >= 1 || roundedVolume <= 0) {
					instance.audio.volume = 0;
					instance.currentVolume = 0;
					if (instance.fadeInterval) {
						clearInterval(instance.fadeInterval);
						instance.fadeInterval = undefined;
					}
					resolve();
				}
			};

			// 使用固定间隔进行平滑过渡
			const fadeInterval = setInterval(updateVolume, this.fadeInterval);
			instance.fadeInterval = fadeInterval;
		});
	}

	// 缓动函数：ease-in-out quad 曲线，提供平滑的音量过渡
	private easeInOutQuad(t: number): number {
		return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
	}

	// 停止音频实例
	private stopAudio(instance: AudioInstance): void {
		if (instance.fadeInterval) {
			clearInterval(instance.fadeInterval);
		}
		
		instance.audio.pause();
		instance.audio.currentTime = 0;
		
		// 清理事件监听器
		instance.audio.removeEventListener('error', () => {});
		instance.audio.removeEventListener('loadeddata', () => {});
		instance.audio.removeEventListener('canplay', () => {});
	}

	// 设置音频事件监听
	private setupAudioEvents(instance: AudioInstance): void {
		const { audio, track } = instance;
		
		audio.addEventListener('error', (e) => {
			console.error('🎵 Audio error:', e);
			console.error('🎵 Failed track:', track);
		});
		
		audio.addEventListener('loadeddata', () => {
			console.log('🎵 Audio loaded:', track.name);
		});
		
		audio.addEventListener('canplay', () => {
			console.log('🎵 Audio ready to play:', track.name);
		});
	}

	// 音频路径解析（复用原有逻辑）
	private async resolveAudioPath(path: string): Promise<string> {
		if (path.startsWith('http://') || path.startsWith('https://')) {
			return path;
		}
		if (path.startsWith('data:')) {
			return path;
		}

		try {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (file && file instanceof TFile) {
				const arrayBuffer = await this.app.vault.readBinary(file);
				const blob = new Blob([arrayBuffer], { type: this.getMimeType(path) });
				const blobUrl = URL.createObjectURL(blob);
				console.log('🎵 Created blob URL for:', path, '->', blobUrl);
				return blobUrl;
			}
		} catch (error) {
			console.log('🎵 Failed to read file via Obsidian API:', error.message);
		}
		
		const adapter = this.app.vault.adapter;
		let vaultPath = '';
		if (adapter && 'basePath' in adapter) {
			vaultPath = (adapter as any).basePath;
		}
		
		if (vaultPath) {
			const fullPath = `${vaultPath}/${path}`.replace(/\\/g, '/');
			const obsidianUrl = `app://local/${fullPath}`;
			console.log('🎵 Using Obsidian URL:', obsidianUrl);
			return obsidianUrl;
		}
		
		return path;
	}

	private getMimeType(filePath: string): string {
		const extension = filePath.split('.').pop()?.toLowerCase();
		switch (extension) {
			case 'mp3': return 'audio/mpeg';
			case 'wav': return 'audio/wav';
			case 'ogg': return 'audio/ogg';
			case 'flac': return 'audio/flac';
			case 'm4a': return 'audio/mp4';
			case 'aac': return 'audio/aac';
			default: return 'audio/mpeg';
		}
	}

	// 获取当前播放状态
	getCurrentBGM(): AudioTrack | null {
		return this.bgmInstance?.track || null;
	}

	getCurrentSFX(): AudioTrack[] {
		return Array.from(this.sfxInstances.values()).map(instance => instance.track);
	}

	isPlaying(): boolean {
		return this.bgmInstance !== null || this.sfxInstances.size > 0;
	}

	// 设置全局音量
	setVolume(volume: number): void {
		this.globalVolume = volume;
		
		if (this.bgmInstance) {
			this.bgmInstance.targetVolume = volume;
			if (!this.bgmInstance.fadeInterval) {
				this.bgmInstance.audio.volume = volume;
				this.bgmInstance.currentVolume = volume;
			}
		}
	}

	// ===== 兼容性方法 (向后兼容旧的AudioEngine API) =====

	// 通用播放方法，根据track.type选择BGM或SFX
	async play(track: AudioTrack): Promise<void> {
		if (track.type === 'sfx') {
			await this.playSFX(track);
		} else {
			await this.playBGM(track); // 默认为BGM
		}
	}

	// 停止播放（alias for stopAll）
	stop(): void {
		this.stopAll();
	}

	// 检查是否正在播放任何音频
	isCurrentlyPlaying(): boolean {
		return this.isPlaying();
	}

	// 暂停当前BGM
	pause(): void {
		if (this.bgmInstance) {
			this.bgmInstance.audio.pause();
		}
	}

	// 恢复播放当前BGM
	resume(): void {
		if (this.bgmInstance && this.bgmInstance.audio.paused) {
			this.bgmInstance.audio.play();
		}
	}

	// 获取当前曲目（只返回BGM）
	getCurrentTrack(): AudioTrack | null {
		return this.getCurrentBGM();
	}

	// 获取当前音量
	getVolume(): number {
		return this.globalVolume;
	}
} 