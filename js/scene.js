import { CONFIG } from './config.js';

export class SceneManager {
    constructor() {
        this.scene = new THREE.Scene();
        this.renderer = null;
        this.camera = null;
        this.container = null;
        
        this.init();
    }
    
    init() {
        this.container = document.getElementById('gameCanvas');
        
        this.setupRenderer();
        this.setupCamera();
        this.setupLighting();
        this.setupFog();
        
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: CONFIG.GRAPHICS.ANTIALIAS 
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.shadowMap.autoUpdate = true;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        
        this.container.appendChild(this.renderer.domElement);
    }
    
    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(
            CONFIG.CAMERA.FOV,
            window.innerWidth / window.innerHeight,
            CONFIG.CAMERA.NEAR,
            CONFIG.CAMERA.FAR
        );
        this.camera.position.set(
            CONFIG.CAMERA.INITIAL_POSITION.x,
            CONFIG.CAMERA.INITIAL_POSITION.y,
            CONFIG.CAMERA.INITIAL_POSITION.z
        );
        this.camera.lookAt(0, 0, 0);
    }
    
    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);
        
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        this.directionalLight.position.set(20, 50, 20);
        this.directionalLight.castShadow = true;
        
        this.directionalLight.shadow.camera.left = -50;
        this.directionalLight.shadow.camera.right = 50;
        this.directionalLight.shadow.camera.top = 50;
        this.directionalLight.shadow.camera.bottom = -50;
        this.directionalLight.shadow.camera.near = 0.1;
        this.directionalLight.shadow.camera.far = 200;
        this.directionalLight.shadow.mapSize.width = CONFIG.GRAPHICS.SHADOW_MAP_SIZE;
        this.directionalLight.shadow.mapSize.height = CONFIG.GRAPHICS.SHADOW_MAP_SIZE;
        this.directionalLight.shadow.bias = -0.001;
        
        this.scene.add(this.directionalLight);
        
        const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x98D8C8, 0.3);
        this.scene.add(hemisphereLight);
    }
    
    setupFog() {
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, 500);
        this.renderer.setClearColor(0x87CEEB);
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    updateCameraPosition(target, offset = CONFIG.CAMERA.ADJUSTMENTS) {
        const targetPosition = new THREE.Vector3().copy(target.position);
        
        const idealPosition = new THREE.Vector3(
            targetPosition.x + offset.SIDE_OFFSET,
            targetPosition.y + offset.HEIGHT,
            targetPosition.z + offset.DISTANCE
        );
        
        this.camera.position.lerp(idealPosition, offset.FOLLOW_FACTOR);
        
        this.camera.lookAt(targetPosition);
        
        // ライトも車の位置に合わせて移動（影が車の近くに落ちるように）
        if (this.directionalLight) {
            this.directionalLight.position.set(
                targetPosition.x + 10,
                targetPosition.y + 30,
                targetPosition.z + 10
            );
            this.directionalLight.target.position.copy(targetPosition);
            this.directionalLight.target.updateMatrixWorld();
        }
    }
    
    render() {
        this.renderer.render(this.scene, this.camera);
    }
}