const FINISH = 48;
const moveSound = new Audio('https://www.soundjay.com/buttons/sounds/button-09.mp3');
const audioContext = window.AudioContext ? new AudioContext() : null;

// Mengaktifkan Audio Context saat pertama kali diklik
document.addEventListener('click', function unlockAudio(){
  if(audioContext && audioContext.state === 'suspended'){
    audioContext.resume().catch(()=>{});
  }
  moveSound.play().then(()=>{
    moveSound.pause();
    moveSound.currentTime = 0;
  }).catch(()=>{});
}, { once: true });

// Mencari Suara Bahasa Indonesia untuk Screen Reader
function getIndonesianVoice(){
  const voices = window.speechSynthesis.getVoices();
  if(!voices.length) return null;

  const indonesianVoices = voices.filter(voice => 
    voice.lang.toLowerCase().startsWith('id') ||
    voice.lang.toLowerCase().includes('indo') ||
    voice.name.toLowerCase().includes('indonesia')
  );

  const femaleVoice = indonesianVoices.find(voice => /female|wanita|femina|siti|ayu|rina|diah|google bahasa indonesia/i.test(voice.name));
  if(femaleVoice) return femaleVoice;

  return indonesianVoices[0] || voices.find(voice => voice.lang.toLowerCase().startsWith('id'))
      || voices.find(voice => voice.lang.toLowerCase().includes('indo'))
      || voices.find(voice => voice.name.toLowerCase().includes('indonesia'))
      || voices[0] || null;
}

// Fungsi Text-to-Speech
function speak(text){
  if('speechSynthesis' in window){
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = getIndonesianVoice();
    if(voice){
      utterance.voice = voice;
      utterance.lang = voice.lang || 'id-ID';
    } else {
      utterance.lang = 'id-ID';
    }
    utterance.rate = 0.9;
    utterance.pitch = 1.15;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  }
}

// Membaca Teks (untuk aksesibilitas)
function announce(text){
  const sr = document.getElementById('srAnnounce');
  if(sr){
    sr.textContent = text;
  }
  speak(text);
}

// Memainkan efek suara gerak
function playMoveSound(){
  if(audioContext){
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(650, now);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.14);
    return;
  }
  moveSound.currentTime = 0;
  moveSound.play().catch(()=>{});
}

function playMoveSounds(times){
  for(let i = 0; i < times; i++){
    setTimeout(playMoveSound, i * 170);
  }
}

// State Game
let players = [];
let currentTurn = 0;
let waitingQuestion = false;
let gameFinished = false;

const diceFaces = ["⚀","⚁","⚂","⚃","⚄","⚅"];

/*
  POSISI KOTAK 1-48
*/
const cellPositions = {
  1:{x:16,y:91}, 2:{x:30,y:91}, 3:{x:44,y:91}, 4:{x:58,y:91}, 5:{x:72,y:91}, 6:{x:86,y:91},
  7:{x:86,y:78}, 8:{x:72,y:78}, 9:{x:58,y:78}, 10:{x:44,y:78}, 11:{x:30,y:78}, 12:{x:16,y:78},
  13:{x:16,y:66}, 14:{x:30,y:66}, 15:{x:44,y:66}, 16:{x:58,y:66}, 17:{x:72,y:66}, 18:{x:86,y:66},
  19:{x:86,y:54}, 20:{x:72,y:54}, 21:{x:58,y:54}, 22:{x:44,y:54}, 23:{x:30,y:54}, 24:{x:16,y:54},
  25:{x:16,y:43}, 26:{x:30,y:43}, 27:{x:44,y:43}, 28:{x:58,y:43}, 29:{x:72,y:43}, 30:{x:86,y:43},
  31:{x:86,y:31}, 32:{x:72,y:31}, 33:{x:58,y:31}, 34:{x:44,y:31}, 35:{x:30,y:31}, 36:{x:16,y:31},
  37:{x:16,y:20}, 38:{x:30,y:20}, 39:{x:44,y:20}, 40:{x:58,y:20}, 41:{x:72,y:20}, 42:{x:86,y:20},
  43:{x:86,y:8}, 44:{x:72,y:8}, 45:{x:58,y:8}, 46:{x:44,y:8}, 47:{x:30,y:8}, 48:{x:16,y:8}
};

/*
  KOTAK KHUSUS (TETAP ADA MERIAM & PEROSOTAN)
*/
const cannonMove = {
  6:9,
  12:15,
  17:22,
  30:33,
};
const slideMove = {
  10:4,
  25:23,
  28:20,
  38:34,
  45:41
};

/*
  BANK SOAL PEMANASAN GLOBAL
*/
const gwQuestions = [
  { q: "Apa gas rumah kaca utama yang dihasilkan oleh aktivitas manusia?", a: "Karbon dioksida (CO2)." },
  { q: "Sebutkan satu dampak utama dari mencairnya es di kutub!", a: "Kenaikan permukaan air laut." },
  { q: "Apa istilah untuk proses terjebaknya panas matahari di atmosfer bumi?", a: "Efek Rumah Kaca." },
  { q: "Sebutkan salah satu energi alternatif yang ramah lingkungan!", a: "Energi surya / angin / air." },
  { q: "Apa dampak pemanasan global terhadap cuaca?", a: "Menyebabkan cuaca ekstrem (badai, kekeringan yang lebih parah)." },
  { q: "Apa fungsi utama pohon dan hutan bagi atmosfer kita?", a: "Menyerap karbon dioksida dan menghasilkan oksigen." },
  { q: "Aktivitas apa yang paling banyak menyumbang emisi metana?", a: "Peternakan (terutama sapi) dan pertanian." },
  { q: "Apa yang dimaksud dengan reboisasi?", a: "Penanaman kembali hutan yang telah gundul." },
  { q: "Mengapa penggunaan plastik sekali pakai berdampak buruk bagi iklim?", a: "Proses pembuatannya menghasilkan emisi karbon tinggi dan sulit terurai." },
  { q: "Apa bahan bakar fosil yang paling banyak digunakan namun sangat berpolusi?", a: "Batu bara." },
  { q: "Apa yang terjadi pada terumbu karang akibat suhu laut yang memanas?", a: "Pemutihan karang (coral bleaching)." },
  { q: "Bagaimana cara sederhana menghemat energi di rumah?", a: "Mematikan lampu dan alat elektronik saat tidak digunakan." }
];

/*
  NAVIGASI MENU
*/
function hideAllSections(){
  ['landing', 'menu', 'materi', 'setup', 'game'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.classList.add('hidden');
  });
}

function showMenu(){
  hideAllSections();
  const menu = document.getElementById('menu');
  if(menu) menu.classList.remove('hidden');
}

function showMateri(){
  hideAllSections();
  const materi = document.getElementById('materi');
  if(materi) materi.classList.remove('hidden');
}

function showPermainan(){
  hideAllSections();
  const setup = document.getElementById('setup');
  if(setup) setup.classList.remove('hidden');
}

/*
  MULAI GAME
*/
function startGame(){
  players = [
    {
      name: document.getElementById("p1").value || "Pemain 1",
      position: 1,
      pawnClass: "pawn1",
      questionCount: 0
    },
    {
      name: document.getElementById("p2").value || "Pemain 2",
      position: 1,
      pawnClass: "pawn2",
      questionCount: 0
    },
    {
      name: document.getElementById("p3").value || "Pemain 3",
      position: 1,
      pawnClass: "pawn3",
      questionCount: 0
    },
    {
      name: document.getElementById("p4").value || "Pemain 4",
      position: 1,
      pawnClass: "pawn4",
      questionCount: 0
    }
  ];

  currentTurn = 0;
  waitingQuestion = false;
  gameFinished = false;

  document.getElementById("setup").classList.add("hidden");
  document.getElementById("game").classList.remove("hidden");

  addLog("Permainan dimulai dari START.");

  render();
}

/*
  RENDER LAYAR
*/
function render(){
  document.getElementById("turnName").textContent = players[currentTurn].name;
  renderPawns();
  renderStatus();
}

function renderPawns(){
  const layer = document.getElementById("pawnLayer");
  layer.innerHTML = "";

  players.forEach((player, index)=>{
    const pos = cellPositions[player.position];
    const pawn = document.createElement("div");
    
    pawn.className = `pawn ${player.pawnClass}`;
    pawn.textContent = index + 1;
    pawn.style.left = `calc(${pos.x}% + ${index*8-12}px)`;
    pawn.style.top = `calc(${pos.y}% + ${index*8-12}px)`;
    
    layer.appendChild(pawn);
  });
}

function renderStatus(){
  const box = document.getElementById("playerStatus");
  box.innerHTML = "";

  players.forEach((player, index)=>{
    box.innerHTML += `
      <div class="player-card">
        <b>${index+1}. ${player.name}</b><br>
        Posisi: ${player.position} <br>
        <small style="font-weight:normal; color:#555;">Soal Dijawab: ${player.questionCount}/15</small>
      </div>
    `;
  });
}

/*
  LEMPAR DADU
*/
function rollDice(){
  if(waitingQuestion || gameFinished) return;

  const player = players[currentTurn];
  announce(`Giliran ${player.name}. Posisi saat ini di kotak ${player.position}. Silakan lempar dadu.`);

  const dice = document.getElementById("dice");
  const btn = document.getElementById("rollBtn");

  btn.disabled = true;
  dice.classList.add("rolling");

  let count = 0;

  const interval = setInterval(()=>{
    const temp = Math.floor(Math.random()*6);
    dice.textContent = diceFaces[temp];
    count++;

    if(count >= 12){
      clearInterval(interval);
      dice.classList.remove("rolling");

      const result = Math.floor(Math.random()*6)+1;
      dice.textContent = diceFaces[result-1];
      document.getElementById("diceResult").textContent = result;

      movePlayer(result).then(()=>{
        if(!gameFinished){
          btn.disabled = false;
        }
      });
    }
  },80);
}

/*
  PERGERAKAN PEMAIN
*/
function movePlayer(dice){
  return new Promise(resolve => {
    const player = players[currentTurn];
    let moves = 0;

    const stepInterval = setInterval(()=>{
      moves++;
      player.position += 1;
      
      if(player.position >= FINISH){
        player.position = FINISH;
      }

      playMoveSound();
      render();

      if(player.position >= FINISH || moves >= dice){
        clearInterval(stepInterval);

        if(player.position >= FINISH){
          winGame(player);
          resolve();
          return;
        }

        addLog(`${player.name} melempar dadu ${dice} dan maju ke ${player.position}`);

        setTimeout(()=>{
          checkSpecialCell();
          resolve();
        },400);
      }
    }, 220);
  });
}

/*
  CEK KOTAK & TRIGGGER SOAL
*/
function checkSpecialCell(){
  const player = players[currentTurn];

  // Cek Meriam
  if(cannonMove[player.position]){
    const old = player.position;
    player.position = cannonMove[player.position];
    addLog(`${player.name} naik meriam dari ${old} ke ${player.position}`);
    playMoveSound();
    render();
  }
  // Cek Perosotan
  else if(slideMove[player.position]){
    const old = player.position;
    player.position = slideMove[player.position];
    addLog(`${player.name} turun perosotan dari ${old} ke ${player.position}`);
    playMoveSound();
    render();
  }

  // Setelah bergerak biasa / naik meriam / turun perosotan, berikan soal jika belum 15
  if(player.questionCount < 15){
    showQuestionCard();
  } else {
    addLog(`${player.name} sudah menyelesaikan batas 15 soal, lanjut tanpa soal.`);
    nextTurn();
  }
}

/*
  TAMPILKAN KARTU SOAL
*/
function showQuestionCard(){
  waitingQuestion = true;
  const player = players[currentTurn];
  player.questionCount++;
  
  const card = randomItem(gwQuestions);
  const box = document.getElementById("questionBox");

  box.className = "question-box general-q";
  box.classList.remove("hidden");
  box.innerHTML = `
    <h3>Soal Pemanasan Global (${player.questionCount}/15)</h3>
    <p><b>Soal:</b> ${card.q}</p>
    <details>
      <summary style="cursor:pointer; font-weight:bold; margin-bottom: 8px;">Lihat Jawaban</summary>
      <p style="margin-top:4px;">${card.a}</p>
    </details>
    <button onclick="answerQuestion(true)">Benar</button>
    <button onclick="answerQuestion(false)">Salah</button>
  `;

  announce(`Soal ke-${player.questionCount}. ${card.q} Tekan tombol Benar jika jawaban tepat, atau Salah jika keliru.`);
  render(); // Memperbarui UI di Status Pemain (X/15)
}

function answerQuestion(correct){
  const player = players[currentTurn];

  if(correct){
    player.position += 2;
    addLog(`${player.name} menjawab benar dan maju 2 langkah`);
    playMoveSounds(2);
  } else {
    player.position -= 1;
    addLog(`${player.name} menjawab salah dan mundur 1 langkah`);
    playMoveSound();
  }

  fixPosition(player);
  
  // Jika langkah bonus/hukuman membuat pemain mencapai Finish
  if(player.position >= FINISH){
     closeQuestion();
     winGame(player);
     return;
  }

  closeQuestion();
  render();
  nextTurn();
}

/*
  UTILITAS / FUNGSI PENDUKUNG
*/
function closeQuestion(){
  waitingQuestion = false;
  const box = document.getElementById("questionBox");
  box.classList.add("hidden");
  box.innerHTML = "";
}

function nextTurn(){
  if(gameFinished) return;
  currentTurn++;
  if(currentTurn >= players.length){
    currentTurn = 0;
  }
  render();
}

function fixPosition(player){
  if(player.position < 1){
    player.position = 1;
  }
  if(player.position > FINISH){
    player.position = FINISH;
  }
}

function winGame(player){
  gameFinished = true;
  render();
  addLog(`${player.name} mencapai FINISH dan memenangkan permainan!`);
  alert(`Selamat, ${player.name} MENANG!`);
  document.getElementById("rollBtn").disabled = true;
}

function randomItem(array){
  return array[Math.floor(Math.random() * array.length)];
}

function addLog(text){
  const box = document.getElementById("logBox");
  box.innerHTML = `<p style="margin:4px 0; border-bottom:1px solid #ddd; padding-bottom:4px;">${text}</p>` + box.innerHTML;
}