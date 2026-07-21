/**
 * 방벽 수호전 (Shooting Defense Game)
 * Core Game Engine, Systems, and API Linkage
 * - 문제를 틀렸을 경우 (오답 제출 / 제한시간 초과) 즉시 3초간 캐릭터와 조수의 미사일 발사 정지
 * - Web Audio API 기반의 합성 사운드 이펙트 엔진 (발사음, 타격음)
 * - '일차식의 계산' 버프 적용 시 30초 동안 캐릭터 옆 3배속 붉은 미사일 쏘는 조수 캐릭터 소환
 * - '소인수분해' 버프에 따른 미사일 증가분을 방사형이 아닌 수직 12시 방향 '병렬 정렬 발사'로 구현
 * - 모든 퀴즈 카테고리를 통틀어 전역 중복 출제 영구 방지 (전체 풀 소진 전까지 중복 없음)
 * - 단일 거대 지네 몬스터 (완전 수평 이동 후 튕길 때 Y축 단단히 하강하는 Sweep-and-Drop 알고리즘)
 * - 경로 추종 궤적 물리 (Path History Tracking) 구현하여 몸통 전체가 지그재그 패턴 유지하며 하강
 * - 몬스터 처치 시 다음 라운드 진입 및 10% 난이도 복리 상승 (속도, 블록HP, 지네마디HP)
 * - 홀수 라운드(1, 3, 5...) 도달 시 문제 난이도 3단계 스케일업
 * - 중복 출제 배제 및 다리 난간 경계(830px 이하) 충돌 제한
 * - 초급 난이도 중학교 1학년 수학 (LaTeX 렌더링 적용)
 * - 미사일 타당 1 피해 적용 (Hit Count 시스템)
 */

// ==========================================================================
// 1. 설정 및 글로벌 환경 변수
// ==========================================================================
const CONFIG = {
  width: 1024,
  height: 576, // 16:9 비율
  laneSplitX: 512, // 좌우 분할선 (50%)
  playerY: 510,
  bulletSpeed: 9,
  monsterBaseSpeed: 0.85, // 가로 수평 기본 이동 속도
  monsterSpawnInterval: 2500, // 처치 후 다음 스폰 대기 시간 (ms)
  blockSpawnInterval: 8000,   // 8초 주기 우측 블록 스폰
  gasUrl: 'https://script.google.com/macros/s/AKfycbz_Placeholder/exec', // GAS URL
};

// Firebase 초기화 설정
const firebaseConfig = {
  databaseURL: ""
};

let db = null;
try {
  if (firebaseConfig.databaseURL) {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
  }
} catch (e) {
  console.warn("Firebase initialization failed. Using LocalStorage mode.", e);
}

// ==========================================================================
// 2. 오프라인 폴백 수학 문제 은행 (중1 초급 수준 - 난이도 1~3 세분화, LaTeX 공식 지정)
// ==========================================================================
const LOCAL_QUESTIONS = [
  // ------------------ 난이도 1 (매우 직관적인 기본 기초식: 1~2라운드용) ------------------
  { id: 1, category: "소인수분해", difficulty: 1, question: "다음 수의 소인수들의 합을 구하시오.", math: "12", answer: 5 }, // 2+3=5
  { id: 2, category: "소인수분해", difficulty: 1, question: "다음 소수들의 곱을 간단히 한 값은?", math: "2^2 \\times 3", answer: 12 },
  { id: 3, category: "정수와 유리수", difficulty: 1, question: "다음 계산 결과를 구하시오.", math: "(-3) + (+5)", answer: 2 },
  { id: 4, category: "정수와 유리수", difficulty: 1, question: "다음 수의 절대값을 구하시오.", math: "|-7|", answer: 7 },
  { id: 5, category: "일차식의 계산", difficulty: 1, question: "식 을 간단히 했을 때, x의 계수를 구하시오.", math: "3x + 2x", answer: 5 },
  { id: 6, category: "일차식의 계산", difficulty: 1, question: "식 을 간단히 했을 때, x의 계수를 구하시오.", math: "2(3x)", answer: 6 },
  { id: 7, category: "일차방정식", difficulty: 1, question: "다음 일차방정식의 해(x)를 구하시오.", math: "x - 4 = 3", answer: 7 },
  { id: 8, category: "일차방정식", difficulty: 1, question: "다음 일차방정식의 해(x)를 구하시오.", math: "2x = 10", answer: 5 },

  // ------------------ 난이도 2 (괄호 연산 및 간단한 2단계 풀이: 3~4라운드용) ------------------
  { id: 9, category: "소인수분해", difficulty: 2, question: "다음 수의 서로 다른 소인수의 개수를 구하시오.", math: "18", answer: 2 }, // 2, 3 -> 2개
  { id: 10, category: "소인수분해", difficulty: 2, question: "다음 수의 약수의 개수를 구하시오.", math: "18", answer: 6 }, // 18 = 2 * 3^2 -> 2 * 3 = 6개
  { id: 11, category: "정수와 유리수", difficulty: 2, question: "다음 식의 계산 결과를 구하시오.", math: "(-4) \\times (-2) - 3", answer: 5 }, // 8 - 3 = 5
  { id: 12, category: "정수와 유리수", difficulty: 2, question: "다음 식의 계산 결과를 구하시오.", math: "10 - (-3) \\times 2", answer: 16 }, // 10 + 6 = 16
  { id: 13, category: "일차식의 계산", difficulty: 2, question: "식 을 간단히 했을 때, 상수항을 구하시오.", math: "4x - 5 + 3", answer: -2 },
  { id: 14, category: "일차식의 계산", difficulty: 2, question: "식 을 간단히 했을 때, x의 계수를 구하시오.", math: "2(3x + 1)", answer: 6 },
  { id: 15, category: "일차방정식", difficulty: 2, question: "다음 일차방정식의 해(x)를 구하시오.", math: "3x + 1 = 10", answer: 3 },
  { id: 16, category: "일차방정식", difficulty: 2, question: "다음 일차방정식의 해(x)를 구하시오.", math: "4x = 2x + 8", answer: 4 },

  // ------------------ 난이도 3 (괄호 전개 및 복사식 계산: 5라운드 이상용) ------------------
  { id: 17, category: "소인수분해", difficulty: 3, question: "다음 수의 소인수들의 곱을 구하시오.", math: "30", answer: 30 }, // 2*3*5 = 30
  { id: 18, category: "소인수분해", difficulty: 3, question: "45에 자연수 a를 곱하여 어떤 자연수의 제곱이 되게 할 때, 가장 작은 자연수 a는?", math: "45 \\times a = b^2", answer: 5 }, // 3^2*5 -> a=5
  { id: 19, category: "정수와 유리수", difficulty: 3, question: "다음 식의 계산 결과를 구하시오.", math: "(-2)^3 \\times 3 - (-6)", answer: -18 }, // -24 + 6 = -18
  { id: 20, category: "정수와 유리수", difficulty: 3, question: "두 유리수 a, b에 대해 a * b = 12 이고 a = -3일 때, b의 값은?", math: "ab=12", answer: -4 },
  { id: 21, category: "일차식의 계산", difficulty: 3, question: "식 을 계산했을 때의 상수항을 구하시오.", math: "(5x - 4) - (2x - 1)", answer: -3 }, // 3x - 3
  { id: 22, category: "일차식의 계산", difficulty: 3, question: "식 을 간단히 했을 때, x의 계수를 구하시오.", math: "3(x - 2) - 2(x + 1)", answer: 1 }, // 3x-6 - 2x-2 = x - 8 -> 1
  { id: 23, category: "일차방정식", difficulty: 3, question: "다음 일차방정식의 해(x)를 구하시오.", math: "2(x - 3) = 4x + 2", answer: -4 }, // 2x-6 = 4x+2 -> -2x=8 -> -4
  { id: 24, category: "일차방정식", difficulty: 3, question: "다음 일차방정식의 해(x)를 구하시오.", math: "0.3x - 0.9 = 0.6", answer: 5 }
];

let fetchedQuestions = [];
let usedQuestionIds = [];

// ==========================================================================
// 2-1. Web Audio API 신디사이저 사운드 모듈
// ==========================================================================
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// 뿅/피융- 하는 SF식 미사일 발사음 합성
function playShootSound(isAssistant = false) {
  if (!audioCtx) return;
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.type = 'sine';
  const now = audioCtx.currentTime;
  
  const startFreq = isAssistant ? 980 : 850;
  const endFreq = isAssistant ? 300 : 180;
  
  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.08);
  
  gain.gain.setValueAtTime(isAssistant ? 0.05 : 0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.005, now + 0.08);
  
  osc.start(now);
  osc.stop(now + 0.09);
}

// 장벽 블록 타격 시 발생하는 공명 탁음 합성 (틱/탁)
function playHitSound() {
  if (!audioCtx) return;
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.type = 'triangle';
  const now = audioCtx.currentTime;
  
  osc.frequency.setValueAtTime(650, now);
  osc.frequency.exponentialRampToValueAtTime(250, now + 0.06);
  
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
  
  osc.start(now);
  osc.stop(now + 0.07);
}

// ==========================================================================
// 3. 게임 시스템 핵심 변수
// ==========================================================================
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
canvas.width = CONFIG.width;
canvas.height = CONFIG.height;

let gameState = 'menu'; // menu, playing, quiz, gameover
let survivalTime = 0;
let lastTime = 0;
let playerHp = 3;
let invulnerableTime = 0;

let playerX = CONFIG.laneSplitX / 2;
let targetPlayerX = playerX;
const playerWidth = 36;
const playerHeight = 44;

let projectiles = [];
let centipedes = []; // 지그재그 단일 지네
let blocks = [];
let particles = [];

// 라운드 시스템 전역 변수
let currentRound = 1;
let roundTextTimer = 0;

// 퀴즈 관련 상태
let activeQuiz = null;
let quizInput = "";
let quizTimer = 30;
let lastActiveBlock = null;

// 버프 시스템
let activeBuffs = {
  streams: 1,
  damageTier: 1, // 소인수분해 데미지 및 색상 티어
  speedMultiplier: 1,
  speedTimer: 0,
  assistantTimer: 0, // 일차식의 계산 버프: 조수 동반 타이머(초)
  freezeTimer: 0
};

// 미사일 연사 타이머
let shootCooldown = 0;
const baseShootCooldown = 320; // ms

// 조수 미사일 연사 타이머 (조수는 3배 빠름 -> 106ms 주기 사격 고정)
let assistantShootTimer = 0;
const assistantShootCooldown = 106; // 3배 빠른 공속 (320 / 3)

let shakeDuration = 0;
let flashDuration = 0;
let keys = {};

// ==========================================================================
// 4. 모바일/태블릿 터치 조작 이벤트 바인딩
// ==========================================================================
let isDragging = false;

const handlePointerMove = (e) => {
  if (gameState !== 'playing') return;
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const relativeX = (clientX - rect.left) / rect.width * CONFIG.width;
  targetPlayerX = Math.max(20, Math.min(820, relativeX));
};

canvas.addEventListener('mousedown', (e) => { isDragging = true; handlePointerMove(e); });
canvas.addEventListener('mousemove', (e) => { if (isDragging) handlePointerMove(e); });
window.addEventListener('mouseup', () => { isDragging = false; });

canvas.addEventListener('touchstart', (e) => { isDragging = true; handlePointerMove(e); }, { passive: true });
canvas.addEventListener('touchmove', (e) => { if (isDragging) handlePointerMove(e); }, { passive: true });
window.addEventListener('touchend', () => { isDragging = false; });

window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// ==========================================================================
// 5. 엔티티 정의 (발사체, 단일 긴 지네, 지식 블록, 이펙트 파티클)
// ==========================================================================

// 5-1) 블루/레드 플라즈마 파이어볼
class Projectile {
  constructor(x, y, vx, vy, isAssistant = false) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = isAssistant ? 6 : 8;
    this.isAssistant = isAssistant;
    this.damage = isAssistant ? 1 : activeBuffs.damageTier;
    this.damageTier = isAssistant ? 1 : activeBuffs.damageTier;
    this.trail = [];
  }

  update() {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 8) this.trail.shift();

    this.x += this.vx;
    this.y += this.vy;
  }

  getGlowColor() {
    if (this.isAssistant) return '#ff003c';
    if (this.damageTier === 2) return '#ffff00'; // 네온 노랑
    if (this.damageTier === 3) return '#39ff14'; // 네온 그린
    if (this.damageTier === 4) return '#ff007f'; // 네온 핑크
    if (this.damageTier >= 5) return '#ffffff';  // 네온 화이트
    return '#00f0ff'; // 기본 파란색
  }

  draw() {
    ctx.save();
    
    const glowColor = this.getGlowColor();
    
    // 코어 색상 및 꼬리 그라디언트 설정
    let coreColor = 'rgba(30, 144, 255, ';
    let trailColorStart = 'rgba(135, 206, 250, ';
    let baseOuterColor = '#0000ff';

    if (this.isAssistant) {
      coreColor = 'rgba(255, 60, 60, ';
      trailColorStart = 'rgba(255, 100, 100, ';
      baseOuterColor = '#99001a';
    } else {
      if (this.damageTier === 2) {
        coreColor = 'rgba(255, 255, 100, ';
        trailColorStart = 'rgba(255, 255, 150, ';
        baseOuterColor = '#b3b300';
      } else if (this.damageTier === 3) {
        coreColor = 'rgba(100, 255, 100, ';
        trailColorStart = 'rgba(150, 255, 150, ';
        baseOuterColor = '#009933';
      } else if (this.damageTier === 4) {
        coreColor = 'rgba(255, 100, 180, ';
        trailColorStart = 'rgba(255, 150, 200, ';
        baseOuterColor = '#b30059';
      } else if (this.damageTier >= 5) {
        coreColor = 'rgba(240, 248, 255, ';
        trailColorStart = 'rgba(245, 245, 245, ';
        baseOuterColor = '#cccccc';
      }
    }

    for (let i = 0; i < this.trail.length; i++) {
      const pos = this.trail[i];
      const alpha = (i + 1) / this.trail.length * 0.4;
      const size = this.radius * (1 + (this.trail.length - i) * 0.15);
      
      const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, size);
      grad.addColorStop(0, `${trailColorStart}${alpha})`);
      grad.addColorStop(0.5, `${coreColor}${alpha * 0.7})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 15;
    ctx.shadowColor = glowColor;
    
    const mainGrad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
    mainGrad.addColorStop(0, '#ffffff');
    mainGrad.addColorStop(0.3, glowColor);
    mainGrad.addColorStop(0.8, baseOuterColor);
    mainGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = mainGrad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// 5-2) 단일 지네 노드 및 거대 지네 (경로 히스토리 추종 물리 시스템 탑재)
class CentipedeSegment {
  constructor(x, y, hp, isHead = false) {
    this.x = x;
    this.y = y;
    this.hp = hp;
    this.maxHp = hp;
    this.isHead = isHead;
    this.baseRadius = isHead ? 25 : 21;
    this.pulseFactor = 0;
  }
}

class CentipedeMonster {
  constructor() {
    this.segments = [];
    this.destroyed = false;
    this.pathHistory = [];

    const segmentCount = 28 + Math.floor(survivalTime / 24);
    const roundMultiplier = 1 + (currentRound - 1) * 0.1;

    let baseHp = 10;
    if (survivalTime <= 60) {
      baseHp = 10 + Math.floor(Math.random() * 6);
    } else if (survivalTime <= 120) {
      baseHp = 20 + Math.floor(Math.random() * 11);
    } else {
      baseHp = 40 + Math.floor(Math.random() * 21);
    }

    const finalHp = Math.round(baseHp * roundMultiplier);

    this.currentDirection = 1;
    this.currentX = CONFIG.laneSplitX / 2;
    this.currentY = -40;

    for (let i = 0; i < segmentCount; i++) {
      const sy = this.currentY - (i * 32);
      this.segments.push(new CentipedeSegment(this.currentX, sy, finalHp, i === 0));
    }

    const initialHistLength = segmentCount * 38; 
    for (let j = 0; j < initialHistLength; j++) {
      this.pathHistory.push({
        x: this.currentX,
        y: this.currentY - j
      });
    }
  }

  update(dt) {
    if (this.segments.length === 0) {
      this.destroyed = true;
      return;
    }

    const roundMultiplier = 1 + (currentRound - 1) * 0.1;
    let speed = CONFIG.monsterBaseSpeed * roundMultiplier;

    if (survivalTime > 60 && survivalTime <= 120) {
      speed *= 1.25;
    } else if (survivalTime > 120) {
      speed *= 1.45;
    }

    if (activeBuffs.freezeTimer > 0) {
      speed = 0;
    }

    const head = this.segments[0];
    if (speed > 0) {
      const leftLimit = 35;
      const rightLimit = CONFIG.laneSplitX - 35;
      
      head.x += this.currentDirection * speed;

      if (head.x >= rightLimit) {
        head.x = rightLimit;
        this.currentDirection = -1;
        head.y += 32;
      } else if (head.x <= leftLimit) {
        head.x = leftLimit;
        this.currentDirection = 1;
        head.y += 32;
      }

      this.pathHistory.unshift({ x: head.x, y: head.y });

      const maxHistoryNeeded = this.segments.length * 45;
      if (this.pathHistory.length > maxHistoryNeeded) {
        this.pathHistory.pop();
      }
    }

    const stepSpacing = 36;
    for (let i = 1; i < this.segments.length; i++) {
      const current = this.segments[i];
      const historyIndex = Math.min(i * stepSpacing, this.pathHistory.length - 1);
      const targetPos = this.pathHistory[historyIndex];

      if (targetPos) {
        current.x = targetPos.x;
        current.y = targetPos.y;
      }
    }

    this.segments.forEach(seg => {
      seg.pulseFactor += dt * 0.005;
    });

    for (let i = this.segments.length - 1; i >= 0; i--) {
      if (this.segments[i].hp <= 0) {
        createExplosion(this.segments[i].x, this.segments[i].y, '#ff3b30', 20);
        this.segments.splice(i, 1);
      }
    }

    if (this.segments.length > 0) {
      this.segments[0].isHead = true;
    }
  }

  draw() {
    for (let i = this.segments.length - 1; i >= 0; i--) {
      const seg = this.segments[i];
      const r = seg.baseRadius * (1 + (survivalTime > 120 ? Math.sin(seg.pulseFactor) * 0.1 : 0));
      
      ctx.save();
      ctx.translate(seg.x, seg.y);

      let angle = 0;
      if (i > 0) {
        angle = Math.atan2(this.segments[i-1].y - seg.y, this.segments[i-1].x - seg.x);
      } else if (this.segments.length > 1) {
        angle = Math.atan2(seg.y - this.segments[1].y, seg.x - this.segments[1].x);
      }
      ctx.rotate(angle);

      // 다리 관절
      ctx.strokeStyle = '#2d1815';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-r * 0.5, -r * 1.3, -r * 0.4, -r * 1.6);
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-r * 0.5, r * 1.3, -r * 0.4, r * 1.6);
      ctx.stroke();

      // 메탈 백 아머 쉘
      const plateColor = activeBuffs.freezeTimer > 0 ? '#1f487e' : '#231f20';
      ctx.fillStyle = plateColor;
      ctx.strokeStyle = '#120f10';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.arc(0, 0, r, Math.PI * 0.5, Math.PI * 1.5);
      ctx.lineTo(r * 0.4, -r * 0.8);
      ctx.lineTo(r * 0.4, r * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 장갑 돌기 가시
      ctx.fillStyle = activeBuffs.freezeTimer > 0 ? '#5b92e5' : '#8b201a';
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, -r * 0.4);
      ctx.lineTo(-r * 1.4, -r * 0.7);
      ctx.lineTo(-r * 0.6, -r * 0.2);
      
      ctx.moveTo(-r * 0.8, r * 0.4);
      ctx.lineTo(-r * 1.4, r * 0.7);
      ctx.lineTo(-r * 0.6, r * 0.2);
      ctx.fill();

      // 머리 마디 더듬이 및 붉은 눈
      if (seg.isHead) {
        ctx.fillStyle = '#ff003c';
        ctx.beginPath();
        ctx.arc(r * 0.4, -r * 0.3, 4, 0, Math.PI * 2);
        ctx.arc(r * 0.4, r * 0.3, 4, 0, Math.PI * 2);
        ctx.arc(r * 0.2, 0, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#120f10';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(r * 0.5, -r * 0.4);
        ctx.quadraticCurveTo(r * 1.3, -r * 0.9, r * 1.6, -r * 1.2);
        ctx.moveTo(r * 0.5, r * 0.4);
        ctx.quadraticCurveTo(r * 1.3, r * 0.9, r * 1.6, r * 1.2);
        ctx.stroke();
      }

      ctx.restore();

      // LED 텍스트 HP 지표
      let textColor = '#ffcc00';
      if (survivalTime > 60 && survivalTime <= 120) {
        textColor = '#ff9500';
      } else if (survivalTime > 120) {
        textColor = '#ff3b30';
      }

      ctx.save();
      ctx.font = `bold ${seg.isHead ? 15 : 13}px 'Orbitron'`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      ctx.shadowBlur = 8;
      ctx.shadowColor = textColor;
      ctx.fillStyle = textColor;
      ctx.fillText(seg.hp, seg.x, seg.y);
      ctx.restore();
    }
  }
}

// 5-3) 파란색 반투명 장벽 지식 블록
class KnowledgeBlock {
  constructor() {
    this.width = 110;
    this.height = 36;
    
    this.x = 530 + Math.random() * 180;
    this.y = -50;
    this.speed = 1.0;
    
    const roundMultiplier = 1 + (currentRound - 1) * 0.1;
    const baseHp = 10 + Math.floor(survivalTime * 0.1);
    this.maxHp = Math.round(baseHp * roundMultiplier);
    this.hp = this.maxHp;

    const categories = ["소인수분해", "정수와 유리수", "일차식의 계산", "일차방정식"];
    this.category = categories[Math.floor(Math.random() * categories.length)];
  }

  update() {
    this.y += this.speed;
  }

  draw() {
    ctx.save();
    
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00f0ff';
    
    const blockGrad = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
    blockGrad.addColorStop(0, 'rgba(0, 240, 255, 0.7)');
    blockGrad.addColorStop(1, 'rgba(0, 100, 255, 0.4)');

    ctx.fillStyle = blockGrad;
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.roundRect(this.x, this.y, this.width, this.height, 6);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x + 8, this.y + this.height/2);
    ctx.lineTo(this.x + this.width - 8, this.y + this.height/2);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px "Noto Sans KR"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.category, this.x + this.width / 2, this.y + 12);

    ctx.font = 'bold 11px "Orbitron"';
    ctx.fillStyle = '#ffcc00';
    ctx.fillText(`Hits: ${this.hp}/${this.maxHp}`, this.x + this.width / 2, this.y + this.height - 10);

    ctx.restore();
  }
}

// 5-4) 폭발 파티클
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.radius = 2 + Math.random() * 4;
    this.vx = (Math.random() - 0.5) * 6;
    this.vy = (Math.random() - 0.5) * 6;
    this.alpha = 1.0;
    this.decay = 0.02 + Math.random() * 0.03;
    this.color = color;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= this.decay;
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function createExplosion(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y, color));
  }
}

// ==========================================================================
// 6. 타이머 기반 무한 스폰 루프 및 라운드 전이 트리거
// ==========================================================================
let monsterSpawnTimer = 0;
let blockSpawnTimer = 0;

function handleSpawning(dt) {
  monsterSpawnTimer += dt;
  blockSpawnTimer += dt;

  if (centipedes.length === 0) {
    if (monsterSpawnTimer >= CONFIG.monsterSpawnInterval) {
      currentRound++;
      document.getElementById('round-display').innerText = currentRound;
      
      roundTextTimer = 100;

      centipedes.push(new CentipedeMonster());
      monsterSpawnTimer = 0;
    }
  } else {
    monsterSpawnTimer = 0;
  }

  if (blockSpawnTimer >= CONFIG.blockSpawnInterval) {
    blocks.push(new KnowledgeBlock());
    blockSpawnTimer = 0;
  }
}

// ==========================================================================
// 7. 스킬/버프 상태 갱신 (일차식의 계산: 조수 30초 타이머 누적)
// ==========================================================================
function updateBuffs(dt) {
  const dtSec = dt / 1000;

  if (activeBuffs.speedTimer > 0) {
    activeBuffs.speedTimer -= dtSec;
    activeBuffs.speedMultiplier = 2;
    document.getElementById('buff-speed').classList.remove('locked');
    document.getElementById('buff-speed').classList.add('active-speed');
    document.getElementById('buff-speed').innerText = `정수와 유리수 (공속: 2x ${Math.ceil(activeBuffs.speedTimer)}s)`;
  } else {
    activeBuffs.speedMultiplier = 1;
    document.getElementById('buff-speed').classList.add('locked');
    document.getElementById('buff-speed').classList.remove('active-speed');
    document.getElementById('buff-speed').innerText = `정수와 유리수 (공속: 2x 0s)`;
  }

  if (activeBuffs.assistantTimer > 0) {
    activeBuffs.assistantTimer -= dtSec;
    document.getElementById('buff-expr').classList.remove('locked');
    document.getElementById('buff-expr').classList.add('active-expr');
    document.getElementById('buff-expr').innerText = `일차식의 계산 (조수: ${Math.ceil(activeBuffs.assistantTimer)}s)`;
  } else {
    activeBuffs.assistantTimer = 0;
    document.getElementById('buff-expr').classList.add('locked');
    document.getElementById('buff-expr').classList.remove('active-expr');
    document.getElementById('buff-expr').innerText = `일차식의 계산 (조수: 0s)`;
  }

  if (activeBuffs.freezeTimer > 0) {
    activeBuffs.freezeTimer -= dtSec;
    document.getElementById('buff-freeze').classList.remove('locked');
    document.getElementById('buff-freeze').classList.add('active-freeze');
    document.getElementById('buff-freeze').innerText = `일차방정식 (빙결 ${Math.ceil(activeBuffs.freezeTimer)}s)`;
  } else {
    activeBuffs.freezeTimer = 0;
    document.getElementById('buff-freeze').classList.add('locked');
    document.getElementById('buff-freeze').classList.remove('active-freeze');
    document.getElementById('buff-freeze').innerText = `일차방정식 (빙결 0s)`;
  }

  if (activeBuffs.streams > 1 || activeBuffs.damageTier > 1) {
    document.getElementById('buff-stream').classList.remove('locked');
    document.getElementById('buff-stream').classList.add('active-stream');
    let tierText = "";
    if (activeBuffs.damageTier === 2) tierText = " [네온노랑]";
    else if (activeBuffs.damageTier === 3) tierText = " [네온그린]";
    else if (activeBuffs.damageTier === 4) tierText = " [네온핑크]";
    else if (activeBuffs.damageTier >= 5) tierText = " [네온화이트]";
    document.getElementById('buff-stream').innerText = `소인수분해 (줄기: +${activeBuffs.streams}${tierText})`;
  } else {
    document.getElementById('buff-stream').classList.add('locked');
    document.getElementById('buff-stream').classList.remove('active-stream');
    document.getElementById('buff-stream').innerText = `소인수분해 (줄기: +1)`;
  }
}

// ==========================================================================
// 8. 물리 업데이트 및 충돌 연산
// ==========================================================================
let penaltyTimer = 0;

function updatePhysics(dt) {
  if (keys['ArrowLeft'] || keys['KeyA']) {
    targetPlayerX = Math.max(20, targetPlayerX - 6);
  }
  if (keys['ArrowRight'] || keys['KeyD']) {
    targetPlayerX = Math.min(820, targetPlayerX + 6);
  }

  playerX += (targetPlayerX - playerX) * 0.2;
  playerX = Math.max(20, Math.min(820, playerX));

  if (invulnerableTime > 0) {
    invulnerableTime -= dt / 1000;
  }

  // 공격 불가 패널티 타이머 감소
  if (penaltyTimer > 0) {
    penaltyTimer -= dt;
  }

  // 1. 본체 자동 미사일 사격
  shootCooldown += dt;
  const currentCooldown = baseShootCooldown / activeBuffs.speedMultiplier;
  if (shootCooldown >= currentCooldown && penaltyTimer <= 0) {
    shootMissiles();
    shootCooldown = 0;
  }

  // 2. 조수 자동 사격 루프 (본체와 마찬가지로 penaltyTimer > 0 일 경우 사격이 정지됩니다!)
  if (activeBuffs.assistantTimer > 0 && penaltyTimer <= 0) {
    assistantShootTimer += dt;
    if (assistantShootTimer >= assistantShootCooldown) {
      const ax = playerX - 26;
      const ay = CONFIG.playerY - 15;
      playShootSound(true);
      
      projectiles.push(new Projectile(ax, ay, 0, -CONFIG.bulletSpeed * 1.1, true));
      assistantShootTimer = 0;
    }
  } else {
    assistantShootTimer = 0;
  }

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    proj.update();
    if (proj.y < -20 || proj.x < 0 || proj.x > CONFIG.width) {
      projectiles.splice(i, 1);
    }
  }

  centipedes.forEach(centipede => centipede.update(dt));

  const defenseLineY = CONFIG.playerY - 10;
  centipedes.forEach(centipede => {
    if (centipede.segments.length > 0) {
      const head = centipede.segments[0];
      if (head.y >= defenseLineY) {
        if (invulnerableTime <= 0) {
          playerHp--;
          triggerDefenseHit();
        }
        head.hp = 0;
      }
    }
  });

  centipedes = centipedes.filter(c => !c.destroyed);

  blocks.forEach(block => block.update());
  blocks = blocks.filter(block => block.y < CONFIG.height + 20);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.update();
    if (p.alpha <= 0) {
      particles.splice(i, 1);
    }
  }

  // 투사체 vs 지식 블록
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    
    for (let j = blocks.length - 1; j >= 0; j--) {
      const block = blocks[j];
      if (
        proj.x > block.x && proj.x < block.x + block.width &&
        proj.y > block.y && proj.y < block.y + block.height
      ) {
        block.hp -= proj.damage;
        playHitSound();
        
        createExplosion(proj.x, proj.y, proj.getGlowColor(), 3);
        projectiles.splice(i, 1);
        
        if (block.hp <= 0) {
          lastActiveBlock = block;
          blocks.splice(j, 1);
          triggerQuiz(block.category);
        }
        break;
      }
    }
  }

  // 투사체 vs 지네 몬스터
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    let hit = false;

    for (let c = 0; c < centipedes.length; c++) {
      const centipede = centipedes[c];
      
      for (let s = 0; s < centipede.segments.length; s++) {
        const seg = centipede.segments[s];
        const dx = proj.x - seg.x;
        const dy = proj.y - seg.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const radiusLimit = seg.baseRadius + proj.radius;

        if (dist < radiusLimit) {
          seg.hp -= proj.damage;
          createExplosion(proj.x, proj.y, proj.getGlowColor(), 3);
          hit = true;
          projectiles.splice(i, 1);
          break;
        }
      }
      if (hit) break;
    }
  }

  if (playerHp <= 0) {
    endGame();
  }
}

function shootMissiles() {
  const streams = activeBuffs.streams;
  const py = CONFIG.playerY - 20;
  
  playShootSound(false);

  if (streams === 1) {
    projectiles.push(new Projectile(playerX, py, 0, -CONFIG.bulletSpeed));
  } else if (streams === 2) {
    projectiles.push(new Projectile(playerX - 10, py, 0, -CONFIG.bulletSpeed));
    projectiles.push(new Projectile(playerX + 10, py, 0, -CONFIG.bulletSpeed));
  } else if (streams === 3) {
    projectiles.push(new Projectile(playerX - 15, py, 0, -CONFIG.bulletSpeed));
    projectiles.push(new Projectile(playerX, py, 0, -CONFIG.bulletSpeed));
    projectiles.push(new Projectile(playerX + 15, py, 0, -CONFIG.bulletSpeed));
  } else if (streams === 4) {
    projectiles.push(new Projectile(playerX - 22, py, 0, -CONFIG.bulletSpeed));
    projectiles.push(new Projectile(playerX - 7, py, 0, -CONFIG.bulletSpeed));
    projectiles.push(new Projectile(playerX + 7, py, 0, -CONFIG.bulletSpeed));
    projectiles.push(new Projectile(playerX + 22, py, 0, -CONFIG.bulletSpeed));
  } else {
    projectiles.push(new Projectile(playerX - 28, py, 0, -CONFIG.bulletSpeed));
    projectiles.push(new Projectile(playerX - 14, py, 0, -CONFIG.bulletSpeed));
    projectiles.push(new Projectile(playerX, py, 0, -CONFIG.bulletSpeed));
    projectiles.push(new Projectile(playerX + 14, py, 0, -CONFIG.bulletSpeed));
    projectiles.push(new Projectile(playerX + 28, py, 0, -CONFIG.bulletSpeed));
  }
}

function triggerDefenseHit() {
  invulnerableTime = 1.5;
  shakeDuration = 18;
  flashDuration = 12;
  
  updateHeartsUI();

  const view = document.getElementById('game-container');
  view.classList.add('camera-shake', 'red-flash');
  setTimeout(() => {
    view.classList.remove('camera-shake', 'red-flash');
  }, 400);
}

function updateHeartsUI() {
  const hpContainer = document.getElementById('shield-hp');
  hpContainer.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const heartSpan = document.createElement('span');
    heartSpan.className = 'heart';
    heartSpan.innerText = i < playerHp ? '❤️' : '🖤';
    hpContainer.appendChild(heartSpan);
  }
}

// ==========================================================================
// 9. 2D 캔버스 렌더러
// ==========================================================================
function renderGame() {
  ctx.clearRect(0, 0, CONFIG.width, CONFIG.height);

  // 바다 영역
  ctx.fillStyle = '#081730';
  ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
  
  // 넘실거리는 청록 해수면
  ctx.fillStyle = '#0b264f';
  ctx.beginPath();
  ctx.moveTo(850, 0);
  ctx.lineTo(CONFIG.width, 0);
  ctx.lineTo(CONFIG.width, CONFIG.height);
  ctx.lineTo(920, CONFIG.height);
  ctx.closePath();
  ctx.fill();

  // 교량 도로 아스팔트 바디
  const roadGrad = ctx.createLinearGradient(0, 0, 850, 0);
  roadGrad.addColorStop(0, '#2b2d35');
  roadGrad.addColorStop(1, '#1e2025');
  ctx.fillStyle = roadGrad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(850, 0);
  ctx.lineTo(920, CONFIG.height);
  ctx.lineTo(0, CONFIG.height);
  ctx.closePath();
  ctx.fill();

  // 중앙 차선 점선 그리기
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.setLineDash([20, 15]);
  ctx.beginPath();
  ctx.moveTo(CONFIG.laneSplitX / 2, 0);
  ctx.lineTo(CONFIG.laneSplitX / 2, CONFIG.height);
  ctx.stroke();
  ctx.setLineDash([]);

  // 우측 레인 경계 구조물 가드레일
  ctx.fillStyle = '#4a4d56';
  ctx.fillRect(CONFIG.laneSplitX - 4, 0, 8, CONFIG.height);
  ctx.fillStyle = '#6c717e';
  ctx.fillRect(CONFIG.laneSplitX - 1, 0, 3, CONFIG.height);

  // 다리 오른쪽 끝 측면 안전 난간 프레임
  ctx.strokeStyle = '#2b2d35';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(850, 0);
  ctx.lineTo(920, CONFIG.height);
  ctx.stroke();
  
  ctx.strokeStyle = '#5a5d66';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(848, 0);
  ctx.lineTo(918, CONFIG.height);
  ctx.stroke();

  // 게임 요소 렌더링
  blocks.forEach(block => block.draw());
  centipedes.forEach(c => c.draw());
  projectiles.forEach(p => p.draw());
  particles.forEach(p => p.draw());

  // 하단 방벽 방어선 네온 라인
  ctx.save();
  ctx.shadowBlur = 10;
  ctx.shadowColor = invulnerableTime > 0 ? '#ff007f' : '#00f0ff';
  ctx.strokeStyle = invulnerableTime > 0 ? '#ff007f' : '#00f0ff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, CONFIG.playerY - 8);
  ctx.lineTo(820, CONFIG.playerY - 8);
  ctx.stroke();
  ctx.restore();

  // 1. 플레이어 캐릭터 본체 그리기
  ctx.save();
  if (invulnerableTime > 0 && Math.floor(Date.now() / 100) % 2 === 0) {
    ctx.globalAlpha = 0.3;
  }

  ctx.shadowBlur = 8;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  
  const px = playerX;
  const py = CONFIG.playerY;

  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(px, py + 12, 18, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#0284c7';
  ctx.strokeStyle = '#00f0ff';
  ctx.beginPath();
  ctx.arc(px, py - 4, 13, Math.PI, 0);
  ctx.lineTo(px + 13, py + 2);
  ctx.lineTo(px - 13, py + 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.roundRect(px - 9, py - 6, 18, 5, 2);
  ctx.fill();

  ctx.fillStyle = '#475569';
  ctx.fillRect(px - 18, py - 2, 6, 10);
  ctx.fillRect(px + 12, py - 2, 6, 10);
  ctx.restore();

  // 2. 동반 '조수' 캐릭터 드로잉
  if (activeBuffs.assistantTimer > 0) {
    ctx.save();
    const ax = playerX - 26;
    const ay = CONFIG.playerY - 15;
    
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff003c';
    
    ctx.fillStyle = '#4a0e17';
    ctx.strokeStyle = '#ff003c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ax, ay, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = '#ff003c';
    ctx.beginPath();
    ctx.arc(ax, ay, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ax - 10, ay);
    ctx.lineTo(ax + 10, ay);
    ctx.stroke();
    ctx.restore();
  }

  // 라운드 상승 알림 텍스트 이펙트
  if (roundTextTimer > 0) {
    roundTextTimer--;
    ctx.save();
    ctx.font = 'bold 36px "Orbitron"';
    ctx.fillStyle = `rgba(255, 204, 0, ${Math.min(1.0, roundTextTimer / 25)})`;
    ctx.textAlign = 'center';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ffcc00';
    ctx.fillText(`ROUND ${currentRound}`, CONFIG.laneSplitX / 2, CONFIG.height / 2 - 20);
    ctx.restore();
  }
}

function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  if (gameState === 'playing') {
    survivalTime += dt / 1000;
    document.getElementById('survival-time').innerText = survivalTime.toFixed(1);

    handleSpawning(dt);
    updatePhysics(dt);
    updateBuffs(dt);
    renderGame();
  }

  requestAnimationFrame(gameLoop);
}


// ==========================================================================
// 11. 퀴즈 팝업 & 가상 키패드 관리 인터페이스 (KaTeX 동적 주입, 중복 방지, 홀수 라운드 난이도)
// ==========================================================================
let countdownInterval = null;

function triggerQuiz(category) {
  gameState = 'quiz';
  quizInput = "";
  quizTimer = 30;
  
  canvas.classList.add('grayscale-blur');

  let targetDifficulty = 1;
  if (currentRound >= 5) {
    targetDifficulty = 3;
  } else if (currentRound >= 3) {
    targetDifficulty = 2;
  }

  const basePool = fetchedQuestions.length > 0 ? fetchedQuestions : LOCAL_QUESTIONS;
  let pool = basePool.filter(q => q.category === category && q.difficulty === targetDifficulty);
  
  if (pool.length === 0) {
    pool = basePool.filter(q => q.category === category);
  }

  // 전역 중복 출제 영구 배제
  let unusedPool = pool.filter(q => !usedQuestionIds.includes(q.id));
  
  if (unusedPool.length === 0) {
    usedQuestionIds = [];
    unusedPool = pool;
  }

  activeQuiz = unusedPool[Math.floor(Math.random() * unusedPool.length)] || pool[0];
  usedQuestionIds.push(activeQuiz.id);

  document.getElementById('quiz-category').innerText = activeQuiz.category;
  document.getElementById('quiz-question-text').innerText = activeQuiz.question;
  document.getElementById('quiz-input-display').innerText = "?";
  document.getElementById('quiz-timer').innerText = "30초";
  document.getElementById('quiz-timer-bar').style.width = "100%";

  const mathFormulaDiv = document.getElementById('quiz-math-formula');
  if (typeof katex !== 'undefined') {
    try {
      katex.render(activeQuiz.math || "", mathFormulaDiv, {
        throwOnError: false,
        displayMode: true
      });
    } catch (err) {
      mathFormulaDiv.innerText = activeQuiz.math || "";
    }
  } else {
    mathFormulaDiv.innerText = activeQuiz.math || "";
  }
  
  document.getElementById('quiz-popup').classList.add('active');

  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    if (gameState !== 'quiz') {
      clearInterval(countdownInterval);
      return;
    }
    quizTimer--;
    document.getElementById('quiz-timer').innerText = `${quizTimer}초`;
    
    const ratio = (quizTimer / 30) * 100;
    document.getElementById('quiz-timer-bar').style.width = `${ratio}%`;

    if (quizTimer <= 0) {
      clearInterval(countdownInterval);
      handleQuizWrong("시간 초과!");
    }
  }, 1000);
}

// 키패드 입력 컨트롤
const keyButtons = document.querySelectorAll('.key-btn');
keyButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    if (gameState !== 'quiz') return;
    const key = btn.getAttribute('data-key');

    if (key === 'del') {
      quizInput = quizInput.slice(0, -1);
    } else if (key === '-') {
      if (quizInput.startsWith('-')) {
        quizInput = quizInput.slice(1);
      } else {
        quizInput = '-' + quizInput;
      }
    } else if (key !== null) {
      if (quizInput.length < 7) {
        if (quizInput === '0' || quizInput === '-0') {
          quizInput = quizInput.replace('0', key);
        } else {
          quizInput += key;
        }
      }
    }

    document.getElementById('quiz-input-display').innerText = quizInput || "?";
  });
});

window.addEventListener('keydown', (e) => {
  if (gameState !== 'quiz') return;
  if (e.key >= '0' && e.key <= '9') {
    if (quizInput.length < 7) {
      if (quizInput === '0' || quizInput === '-0') quizInput = e.key;
      else quizInput += e.key;
    }
  } else if (e.key === '-') {
    if (quizInput.startsWith('-')) quizInput = quizInput.slice(1);
    else quizInput = '-' + quizInput;
  } else if (e.key === 'Backspace') {
    quizInput = quizInput.slice(0, -1);
  } else if (e.key === 'Enter') {
    processAnswerSubmit();
  }
  document.getElementById('quiz-input-display').innerText = quizInput || "?";
});

document.getElementById('pass-btn').addEventListener('click', () => {
  if (gameState !== 'quiz') return;
  clearInterval(countdownInterval);
  penaltyTimer = 3000;
  closeQuizPopup();
  gameState = 'playing';
});

document.getElementById('confirm-btn').addEventListener('click', processAnswerSubmit);

function processAnswerSubmit() {
  if (gameState !== 'quiz') return;
  
  const parsedAns = parseInt(quizInput, 10);
  if (isNaN(parsedAns)) return;

  clearInterval(countdownInterval);

  if (parsedAns === activeQuiz.answer) {
    handleQuizCorrect();
  } else {
    handleQuizWrong("틀렸습니다!");
  }
}

function handleQuizCorrect() {
  const category = activeQuiz.category;

  if (category === "소인수분해") {
    if (activeBuffs.streams < 5) {
      activeBuffs.streams += 1;
    } else {
      if (activeBuffs.damageTier < 5) {
        activeBuffs.damageTier += 1;
      }
    }
  } else if (category === "정수와 유리수") {
    activeBuffs.speedTimer = (activeBuffs.speedTimer || 0) + 30;
  } else if (category === "일차식의 계산") {
    activeBuffs.assistantTimer = (activeBuffs.assistantTimer || 0) + 30;
  } else if (category === "일차방정식") {
    activeBuffs.freezeTimer = (activeBuffs.freezeTimer || 0) + 10;
  }

  closeQuizPopup();
  gameState = 'playing';
}

// 오답 처리 로직에 3초간 공격 불가 패널티(캐릭터 및 조수 공통) 추가 연동
function handleQuizWrong(reason) {
  alert(`${reason}\n정답은 [ ${activeQuiz.answer} ] 입니다.`);
  penaltyTimer = 3000; // 즉시 3초간 미사일 발사 정지
  closeQuizPopup();
  gameState = 'playing';
}

function closeQuizPopup() {
  document.getElementById('quiz-popup').classList.remove('active');
  canvas.classList.remove('grayscale-blur');
}

// ==========================================================================
// 12. GAS 퀴즈 문제 은행 API
// ==========================================================================
async function fetchQuizFromGAS() {
  if (!CONFIG.gasUrl || CONFIG.gasUrl.includes("Placeholder")) return;
  try {
    const response = await fetch(CONFIG.gasUrl);
    if (!response.ok) throw new Error("Network response error");
    const data = await response.json();
    if (data && data.length > 0) {
      fetchedQuestions = data;
      console.log(`GAS 문제 은행 성공적 동기화 완료: ${data.length}문항 로드.`);
    }
  } catch (e) {
    console.warn("GAS Fetch failed. Defaulting to local high-quality database.", e);
  }
}

// ==========================================================================
// 13. Firebase Realtime DB & 리더보드 연동
// ==========================================================================
function registerScore(name, score) {
  if (db) {
    const leaderboardRef = db.ref('leaderboard');
    leaderboardRef.push({
      name: name,
      score: parseFloat(score.toFixed(1)),
      timestamp: Date.now()
    }).then(() => {
      loadLeaderboard();
    });
  } else {
    let localScores = JSON.parse(localStorage.getItem('defense_rank') || '[]');
    localScores.push({
      name: name,
      score: parseFloat(score.toFixed(1)),
      timestamp: Date.now()
    });
    localScores.sort((a, b) => b.score - a.score);
    localScores = localScores.slice(0, 5);
    localStorage.setItem('defense_rank', JSON.stringify(localScores));
    loadLeaderboard();
  }
}

function loadLeaderboard() {
  const leaderboardList = document.getElementById('leaderboard-list');
  leaderboardList.innerHTML = '';

  if (db) {
    db.ref('leaderboard')
      .orderByChild('score')
      .limitToLast(5)
      .once('value', (snapshot) => {
        const list = [];
        snapshot.forEach((child) => {
          list.push(child.val());
        });
        list.reverse();
        renderLeaderboardDOM(list);
      }, (err) => {
        loadLeaderboardLocalStorageFallback(leaderboardList);
      });
  } else {
    loadLeaderboardLocalStorageFallback(leaderboardList);
  }
}

function loadLeaderboardLocalStorageFallback(container) {
  const list = JSON.parse(localStorage.getItem('defense_rank') || '[]');
  list.sort((a, b) => b.score - a.score);
  renderLeaderboardDOM(list.slice(0, 5));
}

function renderLeaderboardDOM(scores) {
  const leaderboardList = document.getElementById('leaderboard-list');
  leaderboardList.innerHTML = '';
  
  if (scores.length === 0) {
    leaderboardList.innerHTML = '<li>아직 등록된 수호자가 없습니다.</li>';
    return;
  }

  scores.forEach((entry, idx) => {
    const li = document.createElement('li');
    li.className = `rank-${idx + 1}`;
    li.innerHTML = `
      <span>${idx + 1}위. <strong>${entry.name}</strong></span>
      <span>${entry.score.toFixed(1)}초</span>
    `;
    leaderboardList.appendChild(li);
  });
}

// ==========================================================================
// 14. 핵심 게임 흐름 상태 전이
// ==========================================================================
function startGame() {
  initAudio();

  gameState = 'playing';
  survivalTime = 0;
  playerHp = 3;
  invulnerableTime = 0;
  penaltyTimer = 0;
  playerX = CONFIG.laneSplitX / 2;
  targetPlayerX = playerX;

  currentRound = 1;
  document.getElementById('round-display').innerText = currentRound;
  roundTextTimer = 100;
  
  projectiles = [];
  centipedes = [];
  blocks = [];
  particles = [];
  usedQuestionIds = [];

  activeBuffs.streams = 1;
  activeBuffs.damageTier = 1;
  activeBuffs.speedMultiplier = 1;
  activeBuffs.speedTimer = 0;
  activeBuffs.assistantTimer = 0;
  activeBuffs.freezeTimer = 0;

  centipedes.push(new CentipedeMonster());
  monsterSpawnTimer = 0;
  blockSpawnTimer = CONFIG.blockSpawnInterval - 2000;

  updateHeartsUI();

  document.getElementById('main-menu').classList.remove('active');
  document.getElementById('game-over').classList.remove('active');
}

function endGame() {
  gameState = 'gameover';
  document.getElementById('final-score').innerText = survivalTime.toFixed(1);
  document.getElementById('game-over').classList.add('active');

  const nameInput = document.getElementById('player-name').value.trim() || '수호자';
  registerScore(nameInput, survivalTime);
}

// ==========================================================================
// 15. 초기화 및 리스너 등록
// ==========================================================================
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('retry-btn').addEventListener('click', startGame);

window.onload = () => {
  fetchQuizFromGAS();
  loadLeaderboard();
  requestAnimationFrame(gameLoop);
};
