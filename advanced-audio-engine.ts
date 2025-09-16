interface AudioTrack {
	path: string;
	name: string;
	volume?: number;
	loop?: boolean;
	fadeIn?: number;
	fadeOut?: number;
	type?: 'bgm' | 'sfx'; // 背景音乐或音效
	priority?: number; // 音效优先级
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
	private app: any;
	private globalVolume: number = 0.7;
	private bgmInstance: AudioInstance | null = null;
	private sfxInstances: Map<string, AudioInstance> = new Map();
	private fadeSteps: number = 50; // 渐变步数
	private fadeInterval: number = 50; // 渐变间隔 (ms)

	constructor(app: any, volume: number = 0.7) {
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

	// 淡入效果
	private async fadeIn(instance: AudioInstance, duration: number): Promise<void> {
		return new Promise((resolve) => {
			const stepVolume = instance.targetVolume / this.fadeSteps;
			const stepTime = duration / this.fadeSteps;
			let currentStep = 0;

			const fadeInterval = setInterval(() => {
				currentStep++;
				const newVolume = Math.min(stepVolume * currentStep, instance.targetVolume);
				
				instance.audio.volume = newVolume;
				instance.currentVolume = newVolume;

				if (currentStep >= this.fadeSteps || newVolume >= instance.targetVolume) {
					clearInterval(fadeInterval);
					instance.audio.volume = instance.targetVolume;
					instance.currentVolume = instance.targetVolume;
					resolve();
				}
			}, stepTime);

			instance.fadeInterval = fadeInterval;
		});
	}

	// 淡出效果
	private async fadeOut(instance: AudioInstance, duration: number): Promise<void> {
		return new Promise((resolve) => {
			const stepVolume = instance.currentVolume / this.fadeSteps;
			const stepTime = duration / this.fadeSteps;
			let currentStep = 0;

			const fadeInterval = setInterval(() => {
				currentStep++;
				const newVolume = Math.max(instance.currentVolume - (stepVolume * currentStep), 0);
				
				instance.audio.volume = newVolume;
				instance.currentVolume = newVolume;

				if (currentStep >= this.fadeSteps || newVolume <= 0) {
					clearInterval(fadeInterval);
					instance.audio.volume = 0;
					instance.currentVolume = 0;
					resolve();
				}
			}, stepTime);

			instance.fadeInterval = fadeInterval;
		});
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
			if (file && file.constructor.name === 'TFile') {
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
} 