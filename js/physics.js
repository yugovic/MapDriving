import { CONFIG } from './config.js';

export class PhysicsWorld {
    constructor() {
        this.world = new CANNON.World();
        this.init();
    }
    
    init() {
        this.world.gravity.set(0, CONFIG.PHYSICS.GRAVITY, 0);
        this.world.broadphase = new CANNON.NaiveBroadphase();
        this.world.solver.iterations = 10;
        this.world.defaultContactMaterial.contactEquationStiffness = 1e8;
        this.world.defaultContactMaterial.contactEquationRelaxation = 4;
        
        const groundMaterial = new CANNON.Material('ground');
        const wheelMaterial = new CANNON.Material('wheel');
        
        const wheelGroundContactMaterial = new CANNON.ContactMaterial(
            wheelMaterial,
            groundMaterial,
            {
                friction: 0.4,
                restitution: 0.3,
                contactEquationStiffness: 1e8,
                contactEquationRelaxation: 4
            }
        );
        
        this.world.addContactMaterial(wheelGroundContactMaterial);
        
        this.createGround(groundMaterial);
    }
    
    createGround(groundMaterial) {
        const groundShape = new CANNON.Box(new CANNON.Vec3(1000, 0.1, 1000));
        const groundBody = new CANNON.Body({
            mass: 0,
            shape: groundShape,
            material: groundMaterial
        });
        groundBody.position.set(0, -0.1, 0);
        this.world.addBody(groundBody);
    }
    
    update(deltaTime) {
        this.world.step(CONFIG.PHYSICS.TIME_STEP, deltaTime, CONFIG.PHYSICS.MAX_SUB_STEPS);
    }
    
    addBody(body) {
        this.world.addBody(body);
    }
    
    removeBody(body) {
        this.world.removeBody(body);
    }
}