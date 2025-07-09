export class InputManager {
    constructor() {
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            brake: false,
            turbo: false
        };
        
        this.debugCallback = null;
        
        this.init();
    }
    
    init() {
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
    }
    
    onKeyDown(event) {
        // Ctrl+Mでデバッグメニューを開く
        if (event.ctrlKey && event.key.toLowerCase() === 'm') {
            event.preventDefault();
            if (this.debugCallback) {
                this.debugCallback();
            }
            return;
        }
        
        switch(event.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                this.keys.forward = true;
                break;
            case 's':
            case 'arrowdown':
                this.keys.backward = true;
                break;
            case 'a':
            case 'arrowleft':
                this.keys.left = true;
                break;
            case 'd':
            case 'arrowright':
                this.keys.right = true;
                break;
            case ' ':
                this.keys.brake = true;
                break;
            case 'shift':
                this.keys.turbo = true;
                break;
        }
    }
    
    onKeyUp(event) {
        switch(event.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                this.keys.forward = false;
                break;
            case 's':
            case 'arrowdown':
                this.keys.backward = false;
                break;
            case 'a':
            case 'arrowleft':
                this.keys.left = false;
                break;
            case 'd':
            case 'arrowright':
                this.keys.right = false;
                break;
            case ' ':
                this.keys.brake = false;
                break;
            case 'shift':
                this.keys.turbo = false;
                break;
        }
    }
    
    getInput() {
        return {
            throttle: this.keys.forward ? 1 : (this.keys.backward ? -1 : 0),
            steering: this.keys.left ? 1 : (this.keys.right ? -1 : 0),
            brake: this.keys.brake,
            turbo: this.keys.turbo
        };
    }
    
    setDebugCallback(callback) {
        this.debugCallback = callback;
    }
}