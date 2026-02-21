/**
 * Voice Service to handle Web Speech API for voice commands.
 */
export class VoiceService {
    constructor(onCommandDetected, onStatusUpdate, onSpeechHeard) {
        this.recognition = null;
        this.isListening = false;
        this.onCommandDetected = onCommandDetected;
        this.onStatusUpdate = onStatusUpdate;
        this.onSpeechHeard = onSpeechHeard;
        this.wakeWord = "sound";
        this.commandTimeout = null;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';

            this.recognition.onresult = (event) => {
                let finalTranscript = '';
                let interimTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                const transcript = (finalTranscript || interimTranscript).toLowerCase().trim();

                if (this.onSpeechHeard && transcript) {
                    this.onSpeechHeard(transcript);
                }

                // SPEED IMPROVEMENT: Process the transcript immediately
                // The browser's `isFinal` tag can be slow. We use a short debounce on the raw transcript.
                const cleanTranscript = transcript.replace(/[.,!?]/g, '').trim();
                let commandToExecute = null;

                if (cleanTranscript.startsWith(this.wakeWord)) {
                    commandToExecute = cleanTranscript.slice(this.wakeWord.length).trim();
                } else if (cleanTranscript.includes(this.wakeWord)) {
                    const wakeIndex = cleanTranscript.indexOf(this.wakeWord);
                    commandToExecute = cleanTranscript.slice(wakeIndex + this.wakeWord.length).trim();
                }

                if (commandToExecute) {
                    // Clear pending timeout to reset the speaking clock
                    if (this.commandTimeout) {
                        clearTimeout(this.commandTimeout);
                    }

                    if (finalTranscript) {
                        // If the browser already finalized it, execute immediately
                        this.onCommandDetected(commandToExecute);
                        this.stop();
                        setTimeout(() => this.start(), 100);
                    } else {
                        // Otherwise wait 1 second of silence before executing the interim phrase
                        this.commandTimeout = setTimeout(() => {
                            this.onCommandDetected(commandToExecute);
                            this.stop();
                            setTimeout(() => this.start(), 100);
                        }, 1000);
                    }
                }
            };

            this.recognition.onstart = () => {
                this.isListening = true;
                this.onStatusUpdate(true);
            };

            this.recognition.onend = () => {
                this.isListening = false;
                // Aggressively restart if we should still be listening
                if (this.shouldListen) {
                    try {
                        this.recognition.start();
                    } catch (e) {
                        // Ignore if already started
                    }
                } else {
                    this.onStatusUpdate(false);
                }
            };

            this.recognition.onerror = (event) => {
                console.error("Speech Recognition Error:", event.error);
                if (event.error === 'not-allowed') {
                    this.shouldListen = false;
                    this.isListening = false;
                    this.onStatusUpdate(false);
                }
                // other errors like 'no-speech' or 'network' will naturally trigger onend
                // where it will automatically restart if this.shouldListen is true
            };
        } else {
            console.warn("Speech Recognition API not supported in this browser.");
        }
    }

    start() {
        this.shouldListen = true;
        if (this.recognition && !this.isListening) {
            try {
                this.recognition.start();
            } catch (e) { }
        }
    }

    stop() {
        this.shouldListen = false;
        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (e) { }
            this.isListening = false;
        }
    }
}

