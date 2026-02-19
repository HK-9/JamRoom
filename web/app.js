const socket = io();

const dom = {
  name: document.getElementById('name'),
  room: document.getElementById('room'),
  joinBtn: document.getElementById('joinBtn'),
  search: document.getElementById('search'),
  searchBtn: document.getElementById('searchBtn'),
  skipBtn: document.getElementById('skipBtn'),
  status: document.getElementById('status'),
  results: document.getElementById('results'),
  queue: document.getElementById('queue'),
  chat: document.getElementById('chat'),
  chatInput: document.getElementById('chatInput'),
  chatBtn: document.getElementById('chatBtn')
};

let state = { roomId: null, name: null, room: null };

function renderRoom(room) {
  state.room = room;
  dom.status.textContent = `Connected to ${room.roomId} | Host: ${room.users.find((u) => u.socketId === room.hostId)?.name || 'n/a'} | Playback: ${room.playback.state}`;

  dom.queue.innerHTML = '';
  room.queue.forEach((item, index) => {
    const li = document.createElement('li');
    li.textContent = `${index + 1}. ${item.track.title} — ${item.track.user} (added by ${item.addedBy})`;
    dom.queue.appendChild(li);
  });

  dom.chat.innerHTML = '';
  room.chat.forEach((msg) => {
    const li = document.createElement('li');
    li.textContent = `${msg.user}: ${msg.text}`;
    dom.chat.appendChild(li);
  });
}

async function searchTracks() {
  const q = dom.search.value.trim();
  if (!q) return;

  dom.results.innerHTML = '<li>Searching...</li>';
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const data = await response.json();

    if (!response.ok) {
      dom.results.innerHTML = `<li>${data.error || 'Search failed'}</li>`;
      return;
    }

    dom.results.innerHTML = '';
    data.tracks.forEach((track) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.textContent = 'Add';
      btn.onclick = () => {
        socket.emit('queue:add', {
          roomId: state.roomId,
          addedBy: state.name,
          track
        });
      };
      li.textContent = `${track.title} — ${track.user} `;
      li.appendChild(btn);
      dom.results.appendChild(li);
    });
  } catch {
    dom.results.innerHTML = '<li>Unable to search right now.</li>';
  }
}

dom.joinBtn.onclick = () => {
  const roomId = dom.room.value.trim();
  const name = dom.name.value.trim();
  if (!roomId || !name) {
    dom.status.textContent = 'Enter both room and name.';
    return;
  }

  state.roomId = roomId;
  state.name = name;
  socket.emit('room:join', { roomId, name });
};

dom.searchBtn.onclick = searchTracks;
dom.skipBtn.onclick = () => socket.emit('queue:skip', { roomId: state.roomId });
dom.chatBtn.onclick = () => {
  const text = dom.chatInput.value.trim();
  if (!text) return;
  socket.emit('chat:send', { roomId: state.roomId, text });
  dom.chatInput.value = '';
};

socket.on('room:state', renderRoom);
socket.on('chat:new', (message) => {
  const li = document.createElement('li');
  li.textContent = `${message.user}: ${message.text}`;
  dom.chat.appendChild(li);
});
socket.on('error:message', (e) => {
  dom.status.textContent = e.message;
});
