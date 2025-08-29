// アセット配置設定
// ユーザーが編集可能な設定ファイル
export const ASSETS_CONFIG = {
    // コーンの配置
    cones: [
        // 左側コーナー
        { x: -30, z: -20 },
        { x: -28, z: -18 },
        { x: -26, z: -16 },
        { x: -24, z: -14 },
        // 右側コーナー
        { x: 30, z: -20 },
        { x: 28, z: -18 },
        { x: 26, z: -16 },
        { x: 24, z: -14 },
        // 左側コーナー（反対側）
        { x: -30, z: 20 },
        { x: -28, z: 18 },
        { x: -26, z: 16 },
        { x: -24, z: 14 },
        // 右側コーナー（反対側）
        { x: 30, z: 20 },
        { x: 28, z: 18 },
        { x: 26, z: 16 },
        { x: 24, z: 14 }
    ],
    
    // タイヤバリアの配置
    tireBarriers: [
        // 左側バリア
        { x: -50, z: 0 },
        { x: -50, z: 5 },
        { x: -50, z: -5 },
        { x: -50, z: 10 },
        { x: -50, z: -10 },
        // 右側バリア
        { x: 50, z: 0 },
        { x: 50, z: 5 },
        { x: 50, z: -5 },
        { x: 50, z: 10 },
        { x: 50, z: -10 }
    ],
    
    // 積み重ねキューブの配置
    cubeStacks: [
        // サンプル配置
        { x: 0, z: -30, count: 3 },
        { x: 10, z: -30, count: 5 },
        { x: -10, z: -30, count: 4 }
    ],
    
    // 3Dオブジェクトの配置
    objects3d: [
        // 道路標識（コース境界に配置）
        { type: 'bigRoadSign', x: -60, z: 0, rotation: 90 },
        { type: 'bigRoadSign', x: 60, z: 0, rotation: -90 },
        
        // 道路ブロック（シケイン用）
        { type: 'roadBlock', x: 20, z: 25, rotation: 45 },
        { type: 'roadBlock', x: -20, z: 35, rotation: -45 },
        
        // 木（コース外側）
        { type: 'tree', x: -70, z: -30, rotation: 0 },
        { type: 'tree', x: -70, z: 30, rotation: 0 },
        { type: 'tree', x: 70, z: -20, rotation: 0 },
        { type: 'tree', x: 70, z: 20, rotation: 0 },
        
        // トラム停留所（観戦エリア）
        { type: 'tramStop', x: -80, z: 0, rotation: 90 },
        
        // 新聞スタンド（パドックエリア）
        { type: 'newsPaperStand', x: 0, z: 50, rotation: 180 },
        
        // トイダック（コース上の障害物）
        { type: 'toyDuck', x: 30, z: -15, rotation: 0 },
        { type: 'toyDuck', x: -35, z: 10, rotation: 45 }
    ],
    
    // 物理設定
    physics: {
        cone: {
            mass: 0.5,          // 軽量で倒れやすい
            restitution: 0.3,   // 反発係数
            friction: 0.8       // 摩擦係数
        },
        tire: {
            mass: 5,            // タイヤは重め
            restitution: 0.6,   // ゴムなので跳ねやすい
            friction: 0.9       // 高摩擦
        },
        cube: {
            mass: 2,            // キューブの重さ
            restitution: 0.2,   // 低反発
            friction: 0.7,      // 中程度の摩擦
            size: 1.5           // キューブのサイズ
        },
        object3d: {
            scale: 1.0,         // 3Dオブジェクトの基本スケール
            castShadow: true,   // 影を落とす
            receiveShadow: true // 影を受ける
        }
    }
};

// カスタムアセット追加の例
// ASSETS_CONFIG.customAssets = [
//     {
//         type: 'cone',
//         position: { x: 0, z: 30 }
//     },
//     {
//         type: 'tire',
//         position: { x: -20, z: 0 }
//     }
// ];