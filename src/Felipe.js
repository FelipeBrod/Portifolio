'use strict';

const _VS = `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const _FS = `
void main() {
  gl_FragColor = vec4(0.6, 0.6, 0.585, 0.4);
}`;

let params = {
  bloomStrength: 0.5,
  bloomThreshold: 0.6,
  bloomRadius: 1.6,
};

//Bloom
var renderTarget1 = new THREE.WebGLRenderTarget(); // <- Opaque objects
var renderTarget2 = new THREE.WebGLRenderTarget(); // <- Glowing objects
let composer;
let renderScene, effectFXAA;
let logo;

//Car
let movingBack = false;
let rr, rl, fl, fr;
let car = {};
let wheel_material, wheel_geometry, big_wheel_geometry;
let damping = 0.7;
let friction = 0.9; //high
let frConstraint, flConstraint, rrConstraint, rlConstraint;

//Scene
let renderer, scene, camera, orbitControl;
let moon = new THREE.Object3D();
let sceneThree;
let controls, gui, levels;
let axesHelper;
let selectedLevel, restartGui, playGui;
let textMass = 50;
let spotLight, hemisphereLight, logoSpotLight;
let directionalShadowHelper;
const lightGroup = new THREE.Group();

//Assets
const textLoader = new THREE.FontLoader();
const textureLoader = new THREE.TextureLoader();
const regularFontPath = '../../assets/fonts/Poppins_Light_Regular.json';
const loader = new THREE.GLTFLoader();
const audioLoader = new THREE.AudioLoader();
loader.setPath('./assets/textures/');
//fonts
const boldFontPath = '../assets/fonts/Poppins_Bold.json';
const lightFontPath = '../assets/fonts/Poppins_ExtraLight_Regular.json';

const audioListener = new THREE.AudioListener();
const crackingSound = new THREE.Audio(audioListener);
const objects = [];

//Game
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('pointerdown', onMouseClick);
window.onkeydown = handleKeyDown;
window.onkeyup = handleKeyUp;
let INTERSECTED;
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

//Physics
Physijs.scripts.worker = '../src/lib/physijs_worker.js';
Physijs.scripts.ammo = './ammo.js';

// initialize the threejs environment
function init() {
  scene = new Physijs.Scene();
  scene.setGravity(new THREE.Vector3(0, 0, -100));
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0xc4c4c4, 10, 1000);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x101000);
  document.body.appendChild(renderer.domElement);

  renderer.shadowMap.enabled = true;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  createAxesHelper();
}

function setupCameraAndLight() {
  camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    1,
    10000
  );
  camera.position.set(0, 0, 100);
  camera.layers.enable(1);
  camera.add(audioListener);

  const ambientLight = new THREE.AmbientLight(0xeeeeee, 1.2);
  scene.add(ambientLight);

  logoSpotLight = new THREE.DirectionalLight(0xffffff, 0.5);
  logoSpotLight.castShadow = true;
  logoSpotLight.position.set(-80, 32, 30);
  logoSpotLight.target.position.set(-52, 25, -10);
  scene.add(logoSpotLight.target);
  scene.add(logoSpotLight);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var light = new THREE.DirectionalLight(0xffffff, 0.2);
  light.position.setScalar(100);
  scene.add(light);

  orbitControl = new THREE.OrbitControls(camera, renderer.domElement);
  createShadowHelpers();
}

function createGeometry() {
  createBloom();
  //const heroText = 'I love making \napplications \nfun \nto \n\nuse';
  const heroArray = ['I love making', '\napplications fun to', '\n\nuse'];

  // let wordsPosX = [0, 3, 14, 0, 29, 38, 0];
  for (let index = 0; index < heroArray.length; index++) {
    createUIText(` ${heroArray[index]}`, -50, 0, 9, 1);
  }

  let moon_mat = new Physijs.createMaterial(
    new THREE.ShaderMaterial({
      uniforms: {},
      fragmentShader: _FS,
      vertexShader: _VS,
    }),
    0.7, //friction
    0.0 //restituiton
  );

  moon = new Physijs.BoxMesh(
    new THREE.BoxGeometry(1000, 1000, 10),
    moon_mat,
    0 //mass
  );

  moon.name = 'moon';
  moon.position.set(0, 0, -8);
  moon.layers.enable(1);
  scene.add(moon);

  logo = add3DGLTF('Logo3D.gltf', -55, 21, 0);
  //console.log(logo);

  createUIText('F E L I P E \nR O D R I G U E S', -44, 26, 2, 3);
  createUIText('W O R K', 20, 30, 2, 2);
  createUIText('C O N T A C T', 32, 30, 2, 2);

  createCar();
}

function createBloom() {
  renderScene = new THREE.RenderPass(scene, camera);
  effectFXAA = new THREE.ShaderPass(THREE.FXAAShader);
  effectFXAA.uniforms.resolution.value.set(
    1 / window.innerWidth,
    1 / window.innerHeight
  );

  let copyShader = new THREE.ShaderPass(THREE.CopyShader);
  copyShader.renderToScreen = true;

  let bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    params.bloomStrength,
    params.bloomRadius,
    params.bloomThreshold
  );

  composer = new THREE.EffectComposer(renderer, renderTarget2);

  bloomPass.threshold = params.bloomThreshold;
  bloomPass.strength = params.bloomStrength;
  bloomPass.radius = params.bloomRadius;
  bloomPass.renderToScreen = true;

  composer.setSize(window.innerWidth, window.innerHeight);
  composer.addPass(renderScene);
  composer.addPass(bloomPass);
  composer.addPass(effectFXAA);
  composer.addPass(copyShader);

  renderer.gammaFactor = 1.0;
  renderer.outputEncoding = THREE.GammaEncoding;
  renderer.toneMappingExposure = Math.pow(0.9, 4.0);

  let gui = new dat.GUI();

  let blm = gui.addFolder('Bloom Setting');

  blm
    .add(params, 'bloomStrength', 0, 10)
    .step(0.01)
    .onChange(function (value) {
      bloomPass.strength = Number(value);
    });
  blm
    .add(params, 'bloomThreshold', 0, 1)
    .step(0.01)
    .onChange(function (value) {
      bloomPass.threshold = Number(value);
    });
  blm
    .add(params, 'bloomRadius', 0, 2)
    .step(0.01)
    .onChange(function (value) {
      bloomPass.radius = Number(value);
    });
  //blm.open();

  let playGame = gui.addFolder('Game');

  playGame = new (function () {
    this.playGame = function () {
      getCarPos();
    };
  })();

  gui.add(playGame, 'playGame');
}

function createCar() {
  var car_material = Physijs.createMaterial(
    new THREE.MeshLambertMaterial({
      color: 0xff4444,
      opacity: 0.9,
      transparent: true,
    }),
    0.5,
    0.5
  );
  let geom = new THREE.BoxGeometry(2, 24, 2);
  car = new Physijs.BoxMesh(geom, car_material, 500);
  car.castShadow = true;
  car.position.set(0, 0, 5);
  scene.add(car);

  // let axisA = createCarAxis(0, 10, 5, 5);
  // let axisB = createCarAxis(0, -10, 5, 5);
  // scene.add(axisA);
  // scene.add(axisB);

  fr = createWheel(5, 10, 5);
  fl = createWheel(-5, 10, 5);
  let fr2 = createWheel(5, 4, 5);
  let fl2 = createWheel(-5, 4, 5);
  rr = createWheel(5, -10, 5);
  rl = createWheel(-5, -10, 5);

  let wheelGroup = new THREE.Group();
  wheelGroup.add(fr, fl, rr, rl);
  car.add(wheelGroup);
  scene.add(fr);
  scene.add(fl);
  scene.add(rr);
  scene.add(rl);

  frConstraint = new Physijs.DOFConstraint(
    fr,
    car,
    new THREE.Vector3(5, 10, 5)
  );
  scene.addConstraint(frConstraint);

  flConstraint = new Physijs.DOFConstraint(
    fl,
    car,
    new THREE.Vector3(-5, 10, 5)
  );
  scene.addConstraint(flConstraint);

  //FRONT WHEELS
  frConstraint.setAngularLowerLimit({ x: 0, y: 0, z: 0 });
  frConstraint.setAngularUpperLimit({ x: 0, y: 0, z: 0 });

  flConstraint.setAngularLowerLimit({ x: 0, y: 0, z: 0 });
  flConstraint.setAngularUpperLimit({ x: 0, y: 0, z: 0 });

  rrConstraint = new Physijs.DOFConstraint(
    rr,
    car,
    new THREE.Vector3(5, -10, 5)
  );
  scene.addConstraint(rrConstraint);

  rlConstraint = new Physijs.DOFConstraint(
    rl,
    car,
    new THREE.Vector3(-5, -10, 5)
  );
  scene.addConstraint(rlConstraint);

  //BACK WHEELS
  rrConstraint.setAngularUpperLimit({ x: 0, y: 0, z: 0 });
  rrConstraint.setAngularLowerLimit({ x: 0, y: 0, z: 0 });

  rlConstraint.setAngularUpperLimit({ x: 0, y: 0, z: 0 });
  rlConstraint.setAngularLowerLimit({ x: 0, y: 0, z: 0 });
}

function createWheel(posX, posY, posZ) {
  let wheel_material = Physijs.createMaterial(
    new THREE.MeshBasicMaterial({
      color: 'grey',
      wireframe: true,
    }),
    0.8, // high friction
    0.9 // medium restitution
  );

  let wheel_geometry = new THREE.CylinderGeometry(2, 2, 4, 20);
  let wheel = new Physijs.CylinderMesh(wheel_geometry, wheel_material, 200);
  wheel.rotation.z = Math.PI / 2;

  wheel.castShadow = true;
  wheel.position.set(posX, posY, posZ);

  return wheel;
}

function createCarAxis(posX = 0, posY = 0, posZ = 0, size = 10) {
  let axisMat = new Physijs.createMaterial(
    new THREE.MeshLambertMaterial({
      color: 0xff4444,
      opacity: 0.8,
      transparent: true,
    }),
    0.5,
    0.5
  );

  let axisGeo = new THREE.BoxGeometry(size, 2, 2);
  let axis = new Physijs.BoxMesh(axisGeo, axisMat, 100);
  axis.position.set(posX, posY, posZ);

  return axis;
}

function getCarPos() {
  console.log(car);
}

function handleKeyDown(keyEvent) {
  switch (keyEvent.keyCode) {
    case 38:
    case 87:
      //Up
      movingBack = false;
      configureAllAngularMotor(-20);
      enableMotors(); /*  */

      break;
    case 40:
    case 83:
      //Down
      movingBack = true;
      configureAllAngularMotor(10);
      enableMotors(); /*  */

      break;
    case 37:
    case 65:
      // Left
      configureMotorsToTurn(8, -10);
      enableMotors(); /*  */

      break;
    case 39:
    case 68:
      // Right
      configureMotorsToTurn(-10, 8);
      enableMotors(); /*  */
      break;
    case 32:
      configureAllAngularMotor(0, false);

    default:
      console.log('not a car control');
  }
}

function enableMotors() {
  flConstraint.enableAngularMotor(0);
  frConstraint.enableAngularMotor(0);
  rlConstraint.enableAngularMotor(0);
  rrConstraint.enableAngularMotor(0);
}

function disableMotors() {
  flConstraint.disableAngularMotor(0);
  frConstraint.disableAngularMotor(0);
  rlConstraint.disableAngularMotor(0);
  rrConstraint.disableAngularMotor(0);
}

function configureAllAngularMotor(velocity, rotateOnAxis = true) {
  let min = 2;
  let max = 1;
  if (!rotateOnAxis) {
    min = 1;
    max = 2;
  }
  frConstraint.configureAngularMotor(0, min, max, velocity, 1000);
  flConstraint.configureAngularMotor(0, min, max, velocity, 1000);
  rlConstraint.configureAngularMotor(0, min, max, velocity, 1000);
  rrConstraint.configureAngularMotor(0, min, max, velocity, 1000);
}

function configureMotorsToTurn(leftMotorsVelocity, rightMotorsVelocity) {
  flConstraint.configureAngularMotor(0, 2, 1, leftMotorsVelocity, 1000);
  frConstraint.configureAngularMotor(0, 2, 1, rightMotorsVelocity, 1000);
  rlConstraint.configureAngularMotor(0, 2, 1, leftMotorsVelocity, 1000);
  rrConstraint.configureAngularMotor(0, 2, 1, rightMotorsVelocity, 1000);
}

function handleKeyUp(keyEvent) {
  switch (keyEvent.keyCode) {
    case 37:
    case 65:
    case 39:
    case 68:
    case 38:
    case 87:
      //UP
      disableMotors();
      break;

    case 40:
    case 83:
      //Down
      movingBack = false;
      disableMotors();
      break;
    default:
  }
}
function add3DGLTF(itemName, posX = 0, posY = 0, posZ = 0) {
  loader.load(
    itemName,
    function (data) {
      data.scene.traverse(function (child) {
        if (child.isMesh) {
          let m = child;
          //m.receiveShadow = true;
          m.castShadow = true;
        }
        if (child.isLight) {
          let l = child;
          l.castShadow = true;
          l.shadow.bias = -0.01;
          l.shadow.mapSize.width = 2048;
          l.shadow.mapSize.height = 2048;
        }
      });

      const model = data.scene;

      model.position.set(posX, posY, posZ);
      //model.layers.enable(0);
      scene.add(model);
    },

    (xhr) => {
      // console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
    },
    (error) => {
      console.log(error);
    }
  );
}

function clearScene() {
  let group = []; // = new THREE.Group();
  for (let i = 0; i < scene.children.length; i++) {
    group.push(scene.children[i]);
    group.forEach((e) => {
      scene.remove(e);
    });
  }
}

function onMouseMove(event) {
  // calculate mouse position in normalized device coordinates
  // (-1 to +1) for both components
  //event.preventDefault();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // calculate objects intersecting the picking ray
  const intersects = raycaster.intersectObjects(scene.children);

  if (intersects.length > 0) {
    if (INTERSECTED != intersects[0].object) {
      if (INTERSECTED) {
        if (INTERSECTED.mesh.name != 'text') {
          INTERSECTED.material.__proto__.color.setHex(INTERSECTED.currentHex);

          INTERSECTED = intersects[0].object;
          INTERSECTED.currentHex = INTERSECTED.material.__proto__.color.getHex();
          INTERSECTED.material.__proto__.color.setHex(0xd3d3ffff);
        } else {
          if (INTERSECTED) {
            INTERSECTED.material.__proto__.color.setHex(INTERSECTED.currentHex);
          }

          INTERSECTED = null;
        }
      }
    }
  }
}

function onMouseClick(event) {
  if (INTERSECTED) {
    let selectedObject = scene.getObjectById(INTERSECTED.id);
    scene.remove(selectedObject);
  }
}

function render() {
  requestAnimationFrame(render);
  scene.simulate(undefined, 4);
  orbitControl.update();

  renderer.autoClear = false;
  renderer.clear();

  renderer.clearDepth();
  camera.layers.set(1);
  renderer.render(scene, camera);

  camera.layers.set(0);
  composer.render();
}

window.onload = () => {
  init();
  setupCameraAndLight();
  createGeometry();
  render();
};

let createMesh = (
  geometryType,
  materialType,
  color = 'red',
  willCastShadow = true,
  willReceiveShadow = true,
  width = 2,
  height = 2,
  depth = 2,
  mass = 10,
  friction = 0.5,
  bouciness = 0.5
) => {
  let shape;
  switch (geometryType) {
    case 'sphere':
      shape = new THREE.SphereGeometry(size, 20, 20);
      break;
    case 'box':
      shape = new THREE.BoxBufferGeometry(size, size, size);
      break;
    case 'plane':
      shape = new THREE.PlaneGeometry(size, size);
      break;
    case 'cylinder':
      shape = new THREE.CylinderBufferGeometry(size, size, size);
      break;
    default:
      console.log('Object type not defined correctly');
      break;
  }

  let material;
  switch (materialType) {
    case 'lambert':
      material = new Physijs.createMaterial(
        new THREE.MeshLambertMaterial({
          color: color,
          transparent: true,
          opacity: 0.8,
        })
      );
      break;
    case 'phong':
      material = new THREE.MeshPhongMaterial({ color: color });
      break;
    case 'standard':
      material = new THREE.MeshStandardMaterial({ color: color });
      break;
    case 'physical':
      material = new THREE.MeshPhysicalMaterial({
        color: color,
        side: THREE.DoubleSide,
      });
      break;

    default:
      console.log('Object material not defined correctly');
      break;
  }

  let mesh = new Physijs.BoxMesh(shape, material, friction, bouciness, mass);

  mesh.castShadow = willCastShadow;
  mesh.receiveShadow = willReceiveShadow;
  return mesh;
};

async function playSound(sound) {
  switch (sound) {
    case 'cracking':
      audioLoader.load('./assets/audio/cracking.flac', function (audioBuffer) {
        crackingSound.setBuffer(audioBuffer);
        crackingSound.play();
      });
      break;
    case 'win':
      audioLoader.load('./assets/audio/win.wav', function (audioBuffer) {
        crackingSound.setBuffer(audioBuffer);
        crackingSound.play();
      });
    case 'gameOver':
      audioLoader.load('./assets/audio/gameOver.wav', function (audioBuffer) {
        crackingSound.setBuffer(audioBuffer);
        crackingSound.play();
      });
      break;
    default:
      console.log('Sound not defined correctly');
      break;
  }
}

function createUIText(
  text,
  posX = 0,
  posY = 0,
  posZ = -10,
  visualHirearchy = 2
) {
  let _color, _size, _font, _bevelSize;
  switch (visualHirearchy) {
    case 1:
      _font = boldFontPath;
      _size = 3;
      _color = 0x6d6e71;
      break;
    case 2:
      _font = regularFontPath;
      _size = 1.5;
      _color = 0x6d6e71;
      break;
    case 3:
      _font = lightFontPath;
      _size = 1.3;
      _color = '0x6d6e71';
      break;
    case 4:
      _font = regularFontPath;
      _size = 1.5;
      _color = 0xffaa0f;
      break;
    case 5:
      _font = regularFontPath;
      _size = 1.5;
      _color = 0xfff000;
      break;
  }

  textLoader.load(_font, (e) => {
    let textUI = text,
      height = 0.05,
      size = _size,
      curveSegments = 4,
      bevelThickness = 0.2,
      bevelSize = 0.01,
      bevelSegments = 3,
      bevelEnabled = true,
      font = e,
      weight = 'normal ', // normal bold
      style = 'normal'; // normal italic

    var textGeo = new THREE.TextGeometry(textUI, {
      size: size,
      height: height,
      curveSegments: curveSegments,

      font: font,
      weight: weight,
      style: style,

      bevelThickness: bevelThickness,
      bevelSize: bevelSize,
      bevelEnabled: bevelEnabled,
    });

    let materialText = Physijs.createMaterial(
      new THREE.MeshBasicMaterial({
        color: 'white',
      }),
      0.9, //friction
      0 //restituiton
    );

    let mesh = new Physijs.BoxMesh(textGeo, materialText, textMass);

    mesh.position.set(posX, posY, posZ);
    mesh.castShadow = true;
    // mesh.layers.enable(1);
    mesh.name = 'text';
    scene.add(mesh);
  });
}

function createAxesHelper(size = 40) {
  axesHelper = new THREE.AxesHelper(size);

  //ddscene.add(axesHelper);
}

function createShadowHelpers() {
  //shadow Helpers;

  lightGroup.children.forEach((e) => {
    if (e.shadow) {
      directionalShadowHelper = new THREE.CameraHelper(e.shadow.camera);
      directionalShadowHelper.visible = true;
      directionalShadowHelper.scale.set(80, 80, 80);
    }
    scene.add(directionalShadowHelper);
  });
}