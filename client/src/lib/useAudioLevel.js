import { useEffect, useState } from 'react';

const BARS = 28;
const SILENT = () => new Array(BARS).fill(0);

/**
 * Taps the microphone through an AnalyserNode and returns a rolling array of
 * normalised amplitudes, so the recorder can draw a waveform that actually
 * reacts to the candidate's voice rather than a canned pulse animation.
 *
 * SpeechRecognition opens its own mic stream; this opens a second one purely
 * for visualisation, and tears it down the moment recording stops.
 */
export function useAudioLevel(active) {
    const [levels, setLevels] = useState(SILENT);
    const [peak, setPeak] = useState(0);

    useEffect(() => {
        if (!active) return undefined;

        let stopped = false;
        let frame;
        let stream;
        let context;

        const start = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                if (stopped) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }

                context = new (window.AudioContext || window.webkitAudioContext)();
                const source = context.createMediaStreamSource(stream);
                const analyser = context.createAnalyser();
                analyser.fftSize = 512;
                analyser.smoothingTimeConstant = 0.75;
                source.connect(analyser);

                const data = new Uint8Array(analyser.frequencyBinCount);

                const tick = () => {
                    analyser.getByteTimeDomainData(data);
                    // RMS around the 128 midpoint gives loudness independent of sign
                    let sum = 0;
                    for (let i = 0; i < data.length; i++) {
                        const deviation = (data[i] - 128) / 128;
                        sum += deviation * deviation;
                    }
                    const rms = Math.sqrt(sum / data.length);
                    const normalised = Math.min(1, rms * 3.2);

                    setPeak(normalised);
                    setLevels((prev) => [...prev.slice(1), normalised]);
                    frame = requestAnimationFrame(tick);
                };
                tick();
            } catch {
                // mic denied or unavailable — the recorder still works, it just
                // renders a flat waveform
            }
        };

        start();

        // Resetting here rather than in the effect body keeps the "stopped"
        // state change out of render and avoids a cascading re-render.
        return () => {
            stopped = true;
            if (frame) cancelAnimationFrame(frame);
            stream?.getTracks().forEach((t) => t.stop());
            context?.close().catch(() => {});
            setLevels(SILENT);
            setPeak(0);
        };
    }, [active]);

    return { levels, peak };
}
