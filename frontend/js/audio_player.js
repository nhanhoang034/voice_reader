export class AudioPlayer {
    constructor() {
        this.audio = new Audio();
        this.cache = new Map();
    }

    setPlaybackRate(rate) {
        this.audio.playbackRate = parseFloat(rate);
    }

    clearCache() {
        for (let url of this.cache.values()) {
            URL.revokeObjectURL(url);
        }
        this.cache.clear();
    }

    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.audio.onended = null;
        this.audio.onerror = null;
        this.audio.onplay = null;
    }

    async prefetch(index, text, voice) {
        if (this.cache.has(index)) return;
        try {
            const res = await fetch("http://127.0.0.1:8000/api/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, voice })
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                this.cache.set(index, url);
            }
        } catch (e) {
            console.warn("Prefetch error:", e);
        }
    }

    async play(index, text, voice, speed, onEnded, onError, onLoadingStart, onLoadingEnd) {
        this.stop();

        let audioUrl = this.cache.get(index);

        if (!audioUrl) {
            if (onLoadingStart) onLoadingStart();
            try {
                const res = await fetch("http://127.0.0.1:8000/api/tts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text, voice })
                });

                if (!res.ok) throw new Error("TTS generation failed");

                const blob = await res.blob();
                audioUrl = URL.createObjectURL(blob);
                this.cache.set(index, audioUrl);
            } catch (err) {
                if (onLoadingEnd) onLoadingEnd();
                if (onError) onError(err);
                return;
            }
        }

        this.audio.src = audioUrl;
        this.setPlaybackRate(speed);

        this.audio.onplay = () => {
            if (onLoadingEnd) onLoadingEnd();
        };

        this.audio.onended = () => {
            if (onEnded) onEnded();
        };

        this.audio.onerror = (e) => {
            if (onLoadingEnd) onLoadingEnd();
            if (onError) onError(e);
        };

        this.audio.play().catch(err => {
            if (onLoadingEnd) onLoadingEnd();
            console.warn("Audio play interrupted:", err);
        });
    }
}