/**
 * 🚨 라두스 고로시 박제소 (CHZZK 인기 클립 명예의 전당 웹앱)
 * Pure Vanilla JS (No Build Framework)
 */

(function () {
  'use strict';

  const DEFAULT_CHANNEL_ID = '3e871ee5eeefd77fff44260a29f24071';
  const STORAGE_KEY_BOOKMARKS = 'ladus_goroshi_bookmarks_v1';
  const STORAGE_KEY_CUSTOM_CLIPS = 'ladus_goroshi_custom_clips_v1';

  // 상태 관리
  const state = {
    channelId: DEFAULT_CHANNEL_ID,
    channelInfo: null,
    clips: [],
    activeClipUID: null,
    currentFilter: 'ALL',
    currentSort: 'READ_COUNT',
    searchQuery: '',
    visibleLimit: 24,
    bookmarks: loadJson(STORAGE_KEY_BOOKMARKS, []),
    customClips: loadJson(STORAGE_KEY_CUSTOM_CLIPS, [])
  };

  // DOM 참조
  const el = {
    channelAvatar: document.getElementById('channelAvatar'),
    liveBadge: document.getElementById('liveBadge'),
    channelNameText: document.getElementById('channelNameText'),
    channelDescText: document.getElementById('channelDescText'),
    chzzkChannelLink: document.getElementById('chzzkChannelLink'),
    totalClipsStat: document.getElementById('totalClipsStat'),
    totalViewsStat: document.getElementById('totalViewsStat'),
    btnRandomGoroshi: document.getElementById('btnRandomGoroshi'),
    btnToggleApiPanel: document.getElementById('btnToggleApiPanel'),
    btnCloseApiPanel: document.getElementById('btnCloseApiPanel'),
    apiPanel: document.getElementById('apiPanel'),
    inputChannelId: document.getElementById('inputChannelId'),
    selectApiOrder: document.getElementById('selectApiOrder'),
    btnSyncApi: document.getElementById('btnSyncApi'),
    apiStatusLog: document.getElementById('apiStatusLog'),
    apiStatusDot: document.getElementById('apiStatusDot'),
    inputCustomClipUrl: document.getElementById('inputCustomClipUrl'),
    inputCustomClipTitle: document.getElementById('inputCustomClipTitle'),
    btnAddCustomClip: document.getElementById('btnAddCustomClip'),
    btnResetDefaults: document.getElementById('btnResetDefaults'),
    btnExportGoroshiData: document.getElementById('btnExportGoroshiData'),

    // 플레이어
    nowPlayingRankBadge: document.getElementById('nowPlayingRankBadge'),
    btnPrevClip: document.getElementById('btnPrevClip'),
    btnNextClip: document.getElementById('btnNextClip'),
    clipIframe: document.getElementById('clipIframe'),
    activeClipTags: document.getElementById('activeClipTags'),
    activeClipTitle: document.getElementById('activeClipTitle'),
    activeClipViews: document.getElementById('activeClipViews'),
    activeClipDate: document.getElementById('activeClipDate'),
    activeClipDuration: document.getElementById('activeClipDuration'),
    activeClipUid: document.getElementById('activeClipUid'),
    btnBookmarkActive: document.getElementById('btnBookmarkActive'),
    btnCopyClipLink: document.getElementById('btnCopyClipLink'),
    btnOpenChzzkClip: document.getElementById('btnOpenChzzkClip'),

    // 아카이브
    categoryTabs: document.getElementById('categoryTabs'),
    inputSearch: document.getElementById('inputSearch'),
    btnClearSearch: document.getElementById('btnClearSearch'),
    quickKeywords: document.getElementById('quickKeywords'),
    selectSort: document.getElementById('selectSort'),
    clipsGrid: document.getElementById('clipsGrid'),
    loadMoreWrap: document.getElementById('loadMoreWrap'),
    btnLoadMore: document.getElementById('btnLoadMore'),
    shownCountText: document.getElementById('shownCountText'),
    filteredTotalText: document.getElementById('filteredTotalText'),
    toastContainer: document.getElementById('toastContainer')
  };

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function saveJson(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (_) {
      // ignore storage quota errors
    }
  }

  // 클립 제목/카테고리 기반 테마 자동 분류
  function classifyClip(clip) {
    const title = (clip.clipTitle || '').toLowerCase();
    const cat = (clip.clipCategory || '').toLowerCase();
    const tags = [];
    const groups = new Set(['ALL']);

    // 1. 애교 / 모찌 / 요망 / 고양이 / 북북
    if (/모찌|애교|요망|고양이|귀욥|귀여|나비|뽀뽀|좋아해서|취해쪄|형아|찹쌀떡|낏땅|두스토랑|북북/.test(title)) {
      tags.push({ label: '🐾 요망/애교주의', type: 'hot' });
      groups.add('CUTE_MOCHI');
    }

    // 2. 괴성 / 비명 / 소리 / 호흡
    if (/오우|스으으|하아아|비명|헉학|뇨뇨|쭈오|쫘압|우욱|소리|기합|채찍/.test(title)) {
      tags.push({ label: '😱 사운드/괴성주의', type: 'hot' });
      groups.add('SCREAM_SOUND');
    }

    // 3. 사죄문 / 거짓말 / 공약 / 통수
    if (/사죄|거짓말|공약|통수|돼지|수위|실화냐|조용/.test(title)) {
      tags.push({ label: '🚨 발언검거/박제', type: 'hot' });
      groups.add('ART_TALK');
    }

    // 4. 게임 클립
    if (cat.includes('dead_by_daylight') || cat.includes('it_takes_two') || cat.includes('cabin') || /데바데/.test(title)) {
      tags.push({ label: `🎮 ${clip.clipCategory}`, type: 'chzzk' });
      groups.add('GAME');
    }

    // 5. 아트 / 그림 / 저챗
    if (cat === 'art' || cat === 'talk' || cat === 'music') {
      const catKor = cat === 'art' ? '🎨 그림/아트' : cat === 'music' ? '🎵 노래/음악' : '🎙️ 저스트채팅';
      tags.push({ label: catKor, type: 'normal' });
      groups.add('ART_TALK');
    }

    // 6. 고조회수 인기 클립 (100뷰 이상)
    if ((clip.readCount || 0) >= 100) {
      tags.unshift({ label: '🔥 인기 박제물', type: 'hot' });
      groups.add('HOT_SHAME');
    }

    if (tags.length === 0) {
      tags.push({ label: '📌 일반 박제물', type: 'normal' });
    }

    return { tags, groups };
  }

  // 초기 데이터 로드
  function initData() {
    if (window.LADUS_INITIAL_DATA) {
      state.channelInfo = window.LADUS_INITIAL_DATA.channel;
      const baseClips = window.LADUS_INITIAL_DATA.clips || [];
      mergeClips(baseClips);
    }
    if (state.customClips.length > 0) {
      mergeClips(state.customClips);
    }
    renderChannelHeader();
    renderAll();

    // 첫 번째 랭킹 1위 클립 자동 선택
    const sorted = getSortedFilteredClips();
    if (sorted.length > 0) {
      selectActiveClip(sorted[0].clipUID, false);
    }
  }

  // 클립 배열 병합 (중복 clipUID 제거 및 최신 조회수 반영)
  function mergeClips(newClips) {
    const map = new Map();
    state.clips.forEach((c) => map.set(c.clipUID, c));
    newClips.forEach((c) => {
      if (!c || !c.clipUID) return;
      const prev = map.get(c.clipUID);
      map.set(c.clipUID, {
        ...prev,
        ...c,
        readCount: Math.max(prev?.readCount || 0, c.readCount || 0)
      });
    });
    state.clips = Array.from(map.values());
  }

  // 치지직 API 호출 (로컬 프록시 -> 멀티 CORS 프록시 폴백 체인)
  async function fetchChzzkApiWithCorsFallback(targetUrl) {
    const strategies = [
      {
        name: 'Local Proxy (/api/proxy)',
        buildUrl: () => `/api/proxy?url=${encodeURIComponent(targetUrl)}`,
        parse: async (res) => res.json()
      },
      {
        name: 'AllOrigins JSON Wrapper',
        buildUrl: () => `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
        parse: async (res) => {
          const wrapper = await res.json();
          return JSON.parse(wrapper.contents);
        }
      },
      {
        name: 'AllOrigins Raw',
        buildUrl: () => `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
        parse: async (res) => res.json()
      },
      {
        name: 'CorsProxy.io',
        buildUrl: () => `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`,
        parse: async (res) => res.json()
      },
      {
        name: 'CodeTabs Proxy',
        buildUrl: () => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
        parse: async (res) => res.json()
      }
    ];

    for (const strat of strategies) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5500);
        const res = await fetch(strat.buildUrl(), { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) continue;
        const json = await strat.parse(res);
        if (json && (json.code === 200 || json.content)) {
          return { data: json.content || json, proxyName: strat.name };
        }
      } catch (_) {
        // 다음 프록시로 폴백
      }
    }
    throw new Error('모든 CORS 프록시 응답 지연 또는 차단됨');
  }

  // 치지직 채널 & 클립 API 동기화 실행 (인기순 + 최신순 동시 수집)
  async function syncFromChzzkApi() {
    const channelId = (el.inputChannelId.value || '').trim() || DEFAULT_CHANNEL_ID;
    const orderType = el.selectApiOrder.value || 'POPULAR';
    state.channelId = channelId;

    el.btnSyncApi.disabled = true;
    el.btnSyncApi.textContent = '⏳ 동기화 중...';
    el.apiStatusLog.textContent = `📡 치지직 API 요청 중... (채널 ID: ${channelId.slice(0, 10)}..., 인기순 + 최신순 병합)`;

    try {
      const channelUrl = `https://api.chzzk.naver.com/service/v1/channels/${channelId}`;
      const popularUrl = `https://api.chzzk.naver.com/service/v1/channels/${channelId}/clips?filterType=ALL&orderType=POPULAR&size=50`;
      const recentUrl = `https://api.chzzk.naver.com/service/v1/channels/${channelId}/clips?filterType=ALL&orderType=RECENT&size=50`;

      const [chResult, popResult, recResult] = await Promise.allSettled([
        fetchChzzkApiWithCorsFallback(channelUrl),
        fetchChzzkApiWithCorsFallback(popularUrl),
        fetchChzzkApiWithCorsFallback(recentUrl)
      ]);

      let syncedClipsCount = 0;
      let usedProxy = '';
      const combinedClips = [];

      if (chResult.status === 'fulfilled' && chResult.value.data) {
        state.channelInfo = chResult.value.data;
        usedProxy = chResult.value.proxyName;
      }

      if (recResult.status === 'fulfilled' && recResult.value.data?.data) {
        combinedClips.push(...recResult.value.data.data);
        usedProxy = recResult.value.proxyName;
      }

      if (popResult.status === 'fulfilled' && popResult.value.data?.data) {
        combinedClips.push(...popResult.value.data.data);
        usedProxy = popResult.value.proxyName;
      }

      if (combinedClips.length > 0) {
        if (channelId !== DEFAULT_CHANNEL_ID) {
          state.clips = [];
        }
        mergeClips(combinedClips);
        syncedClipsCount = combinedClips.length;
      }

      if (syncedClipsCount > 0) {
        if (orderType === 'RECENT') {
          state.currentSort = 'NEWEST';
          el.selectSort.value = 'NEWEST';
        }
        renderChannelHeader();
        renderAll();
        const sorted = getSortedFilteredClips();
        if (sorted.length > 0 && !state.clips.some((c) => c.clipUID === state.activeClipUID)) {
          selectActiveClip(sorted[0].clipUID, false);
        }
        el.apiStatusLog.textContent = `✅ 실시간 API 동기화 성공! (${usedProxy} 경유 · 총 ${state.clips.length}개 클립 보유 중)`;
        showToast(`⚡ 치지직 실시간 API 동기화 완료! (총 ${state.clips.length}개 클립)`);
      } else {
        throw new Error('CORS 프록시 응답 없음');
      }
    } catch (err) {
      if (channelId === DEFAULT_CHANNEL_ID && window.LADUS_INITIAL_DATA) {
        mergeClips(window.LADUS_INITIAL_DATA.clips || []);
        renderChannelHeader();
        renderAll();
        el.apiStatusLog.innerHTML =
          `⚠️ 외부 공개 CORS 프록시가 네이버 방화벽에 의해 제한되어 <strong>내장된 라두스 전체 클립 스냅샷(${state.clips.length}개, 최신 11월 클립 포함)</strong>으로 유지됩니다. (폴더의 <code>start-server.bat</code> 실행 시 100% 실시간 직결 가능!)`;
        showToast(`💡 내장된 라두스 전체 클립 ${state.clips.length}개 데이터를 사용합니다.`);
      } else {
        el.apiStatusLog.textContent = `❌ API 호출 실패: 브라우저 CORS 제한으로 차단되었습니다. start-server.bat으로 로컬 서버를 실행해 주세요.`;
        showToast('⚠️ 외부 CORS 프록시 호출이 제한되었습니다.', true);
      }
    } finally {
      el.btnSyncApi.disabled = false;
      el.btnSyncApi.textContent = '🔄 지금 API 동기화';
    }
  }

  // 상단 헤더 & 전체 통계 업데이트
  function renderChannelHeader() {
    const ch = state.channelInfo;
    if (ch) {
      el.channelNameText.textContent = ch.channelName || '라두스';
      if (ch.channelImageUrl) {
        el.channelAvatar.src = ch.channelImageUrl;
      }
      if (ch.channelDescription) {
        el.channelDescText.textContent = `${ch.channelDescription} · 팔로워 ${(ch.followerCount || 0).toLocaleString()}명`;
      }
      el.chzzkChannelLink.href = `https://chzzk.naver.com/${ch.channelId || state.channelId}`;
      if (ch.openLive) {
        el.liveBadge.textContent = 'LIVE';
        el.liveBadge.classList.remove('offline');
      } else {
        el.liveBadge.textContent = 'OFFLINE';
        el.liveBadge.classList.add('offline');
      }
    }

    const totalClips = state.clips.length;
    const totalViews = state.clips.reduce((acc, c) => acc + (c.readCount || 0), 0);

    el.totalClipsStat.textContent = `${totalClips.toLocaleString()}개`;
    el.totalViewsStat.textContent = `${totalViews.toLocaleString()}회`;
  }

  // 탭별 카운트 업데이트
  function updateCategoryCounts() {
    const counts = {
      ALL: state.clips.length,
      HOT_SHAME: 0,
      CUTE_MOCHI: 0,
      SCREAM_SOUND: 0,
      ART_TALK: 0,
      GAME: 0,
      BOOKMARK: state.bookmarks.length
    };

    state.clips.forEach((clip) => {
      const { groups } = classifyClip(clip);
      groups.forEach((g) => {
        if (g !== 'ALL' && counts[g] !== undefined) counts[g]++;
      });
    });

    Object.keys(counts).forEach((key) => {
      const badge = document.getElementById(`tabCount-${key}`);
      if (badge) badge.textContent = counts[key];
    });
  }

  // 필터링 및 정렬된 클립 리스트 반환
  function getSortedFilteredClips() {
    const q = state.searchQuery.trim().toLowerCase();

    const filtered = state.clips.filter((clip) => {
      if (state.currentFilter === 'BOOKMARK') {
        if (!state.bookmarks.includes(clip.clipUID)) return false;
      } else if (state.currentFilter !== 'ALL') {
        const { groups } = classifyClip(clip);
        if (!groups.has(state.currentFilter)) return false;
      }

      if (q) {
        const titleMatch = (clip.clipTitle || '').toLowerCase().includes(q);
        const uidMatch = (clip.clipUID || '').toLowerCase().includes(q);
        const catMatch = (clip.clipCategory || '').toLowerCase().includes(q);
        return titleMatch || uidMatch || catMatch;
      }
      return true;
    });

    filtered.sort((a, b) => {
      switch (state.currentSort) {
        case 'READ_COUNT':
          return (b.readCount || 0) - (a.readCount || 0);
        case 'NEWEST':
          return String(b.createdDate || '').localeCompare(String(a.createdDate || ''));
        case 'OLDEST':
          return String(a.createdDate || '').localeCompare(String(b.createdDate || ''));
        case 'DURATION_DESC':
          return (b.duration || 0) - (a.duration || 0);
        default:
          return (b.readCount || 0) - (a.readCount || 0);
      }
    });

    return filtered;
  }

  // 전체 조회수 랭킹 순위(1-based) 계산
  function getGlobalRankMap() {
    const allSorted = [...state.clips].sort((a, b) => (b.readCount || 0) - (a.readCount || 0));
    const rankMap = new Map();
    allSorted.forEach((c, idx) => rankMap.set(c.clipUID, idx + 1));
    return rankMap;
  }

  // 클립 아카이브 그리드 렌더링
  function renderClipsGrid() {
    updateCategoryCounts();
    const filtered = getSortedFilteredClips();
    const rankMap = getGlobalRankMap();
    const visible = filtered.slice(0, state.visibleLimit);

    el.shownCountText.textContent = visible.length.toLocaleString();
    el.filteredTotalText.textContent = filtered.length.toLocaleString();

    if (filtered.length <= state.visibleLimit) {
      el.loadMoreWrap.classList.add('hidden');
    } else {
      el.loadMoreWrap.classList.remove('hidden');
    }

    if (visible.length === 0) {
      el.clipsGrid.innerHTML = `
        <div class="empty-state">
          <h3>🕵️‍♂️ 조건에 맞는 박제 클립이 없습니다!</h3>
          <p>다른 검색어나 카테고리를 선택해 보세요.</p>
        </div>
      `;
      return;
    }

    el.clipsGrid.innerHTML = visible
      .map((clip) => {
        const globalRank = rankMap.get(clip.clipUID) || '-';
        const isPlaying = clip.clipUID === state.activeClipUID;
        const dateShort = (clip.createdDate || '').split(' ')[0] || '-';

        const thumbHtml = clip.thumbnailImageUrl
          ? `<img src="${escapeHtml(clip.thumbnailImageUrl)}" alt="${escapeHtml(clip.clipTitle)}" loading="lazy" />`
          : `<div class="thumb-fallback"><span>🐾</span><small>${escapeHtml(clip.clipTitle)}</small></div>`;

        return `
          <article class="clip-card ${isPlaying ? 'now-playing' : ''}" data-clip-uid="${escapeHtml(clip.clipUID)}">
            <div class="clip-thumb-box" data-action="play" data-clip-uid="${escapeHtml(clip.clipUID)}">
              ${thumbHtml}
              <span class="clip-rank-badge ${globalRank <= 10 ? 'top-rank' : ''}">#${globalRank}</span>
              <span class="clip-duration-pill">${formatDuration(clip.duration)}</span>
              <div class="play-hover-overlay">
                <div class="play-circle-icon">▶</div>
              </div>
            </div>
            <div class="clip-card-body">
              <div>
                <h3 class="clip-card-title" data-action="play" data-clip-uid="${escapeHtml(clip.clipUID)}">
                  ${escapeHtml(clip.clipTitle)}
                </h3>
              </div>
              <div class="clip-card-footer">
                <div class="clip-meta-stats">
                  <span>👁️ ${(clip.readCount || 0).toLocaleString()}회</span>
                  <span>${dateShort}</span>
                </div>
              </div>
            </div>
          </article>
        `;
      })
      .join('');
  }

  // 클립 선택 및 극장 플레이어 로드
  function selectActiveClip(clipUID, scrollToTheater = true) {
    const clip = state.clips.find((c) => c.clipUID === clipUID);
    if (!clip) return;

    const isSameClip = state.activeClipUID === clipUID;
    state.activeClipUID = clipUID;

    // iframe 주소 업데이트 (치지직 공식 클립 임베드)
    const embedUrl = `https://chzzk.naver.com/embed/clip/${encodeURIComponent(clip.clipUID)}`;
    if (!isSameClip || el.clipIframe.src === 'about:blank') {
      el.clipIframe.src = embedUrl;
    }

    updateTheaterMetadata(clip);
    renderClipsGrid();

    if (scrollToTheater) {
      document.getElementById('theaterSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // 극장 메타데이터 렌더링
  function updateTheaterMetadata(clip) {
    const rankMap = getGlobalRankMap();
    const rank = rankMap.get(clip.clipUID) || 1;

    el.nowPlayingRankBadge.textContent = `👑 인기 랭킹 #${rank} 재생 중`;
    el.activeClipTitle.textContent = clip.clipTitle;
    el.activeClipViews.textContent = (clip.readCount || 0).toLocaleString();
    el.activeClipDate.textContent = (clip.createdDate || '-').split(' ')[0];
    el.activeClipDuration.textContent = `${clip.duration || 0}초`;
    el.activeClipUid.textContent = clip.clipUID;
    el.btnOpenChzzkClip.href = `https://chzzk.naver.com/clips/${encodeURIComponent(clip.clipUID)}`;

    // 북마크 상태
    const isBookmarked = state.bookmarks.includes(clip.clipUID);
    el.btnBookmarkActive.classList.toggle('active-bookmark', isBookmarked);
    el.btnBookmarkActive.textContent = isBookmarked ? '⭐ 박제함 저장됨' : '⭐ 박제함 찜';
  }

  function renderAll() {
    renderClipsGrid();
  }

  // 유틸 함수
  function formatDuration(sec) {
    const s = Math.max(0, Number(sec) || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${String(rem).padStart(2, '0')}`;
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToast(msg, isDanger = false) {
    const div = document.createElement('div');
    div.className = `toast-msg ${isDanger ? 'toast-danger' : ''}`;
    div.textContent = msg;
    el.toastContainer.appendChild(div);
    setTimeout(() => div.remove(), 3200);
  }

  function extractClipUidFromInput(raw) {
    const trimmed = raw.trim();
    const match = trimmed.match(/clips\/([A-Za-z0-9_-]+)/) || trimmed.match(/clip\/([A-Za-z0-9_-]+)/);
    if (match) return match[1];
    if (/^[A-Za-z0-9_-]{6,20}$/.test(trimmed)) return trimmed;
    return null;
  }

  // 이벤트 바인딩
  function bindEvents() {
    // 1. 랜덤 박제 클립 재생
    el.btnRandomGoroshi.addEventListener('click', () => {
      if (state.clips.length === 0) return;
      const randomClip = state.clips[Math.floor(Math.random() * state.clips.length)];
      selectActiveClip(randomClip.clipUID, true);
      showToast(`🎲 무작위 클립 재생: "${randomClip.clipTitle}"`);
    });

    // 2. API 설정 패널 토글
    el.btnToggleApiPanel.addEventListener('click', () => {
      el.apiPanel.classList.toggle('hidden');
    });
    el.btnCloseApiPanel.addEventListener('click', () => {
      el.apiPanel.classList.add('hidden');
    });

    // 3. API 동기화 실행
    el.btnSyncApi.addEventListener('click', () => {
      syncFromChzzkApi();
    });

    // 4. 수동 클립 박제 추가
    el.btnAddCustomClip.addEventListener('click', () => {
      const rawUrl = el.inputCustomClipUrl.value;
      const customTitle = el.inputCustomClipTitle.value.trim();
      const uid = extractClipUidFromInput(rawUrl);

      if (!uid) {
        showToast('⚠️ 올바른 치지직 클립 주소(https://chzzk.naver.com/clips/...)나 클립 UID를 입력해 주세요.', true);
        return;
      }

      const newClip = {
        clipUID: uid,
        clipTitle: customTitle || `시청자 제보 박제 클립 (${uid})`,
        thumbnailImageUrl: '',
        categoryType: 'ETC',
        clipCategory: 'talk',
        duration: 30,
        createdDate: new Date().toISOString().slice(0, 19).replace('T', ' '),
        readCount: 100
      };

      state.customClips.unshift(newClip);
      saveJson(STORAGE_KEY_CUSTOM_CLIPS, state.customClips);
      mergeClips([newClip]);
      renderChannelHeader();
      renderAll();
      selectActiveClip(uid, true);

      el.inputCustomClipUrl.value = '';
      el.inputCustomClipTitle.value = '';
      showToast(`📌 클립 [${newClip.clipTitle}] 박제 등록 완료!`);
    });

    // 5. 기본 채널 초기화 & 백업/초기화
    el.btnResetDefaults.addEventListener('click', () => {
      el.inputChannelId.value = DEFAULT_CHANNEL_ID;
      state.channelId = DEFAULT_CHANNEL_ID;
      if (window.LADUS_INITIAL_DATA) {
        state.channelInfo = window.LADUS_INITIAL_DATA.channel;
        state.clips = [...window.LADUS_INITIAL_DATA.clips];
        mergeClips(state.customClips);
        renderChannelHeader();
        renderAll();
        showToast('✅ 라두스 기본 채널 클립(250개)으로 복원했습니다.');
      }
    });

    el.btnExportGoroshiData.addEventListener('click', () => {
      const payload = {
        exportedAt: new Date().toISOString(),
        channelId: state.channelId,
        bookmarks: state.bookmarks,
        customClips: state.customClips
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ladus-archive-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('💾 내 박제함 백업 파일이 다운로드되었습니다.');
    });

    // 6. 플레이어 컨트롤 (이전/다음 클립, 북마크, 링크 복사)
    el.btnPrevClip.addEventListener('click', () => navigateAdjacentClip(-1));
    el.btnNextClip.addEventListener('click', () => navigateAdjacentClip(1));

    el.btnBookmarkActive.addEventListener('click', () => {
      if (!state.activeClipUID) return;
      const idx = state.bookmarks.indexOf(state.activeClipUID);
      if (idx >= 0) {
        state.bookmarks.splice(idx, 1);
        showToast('내 박제함에서 제거했습니다.');
      } else {
        state.bookmarks.push(state.activeClipUID);
        showToast('⭐ 내 박제함에 영구 보관했습니다!');
      }
      saveJson(STORAGE_KEY_BOOKMARKS, state.bookmarks);
      const activeClip = state.clips.find((c) => c.clipUID === state.activeClipUID);
      if (activeClip) updateTheaterMetadata(activeClip);
      updateCategoryCounts();
      if (state.currentFilter === 'BOOKMARK') renderClipsGrid();
    });

    el.btnCopyClipLink.addEventListener('click', async () => {
      if (!state.activeClipUID) return;
      const url = `https://chzzk.naver.com/clips/${state.activeClipUID}`;
      try {
        await navigator.clipboard.writeText(url);
        showToast('🔗 치지직 클립 링크가 클립보드에 복사되었습니다!');
      } catch (_) {
        showToast(`클립 주소: ${url}`);
      }
    });

    // 7. 클립 그리드 클릭 이벤트 (재생)
    el.clipsGrid.addEventListener('click', (e) => {
      const playTarget = e.target.closest('[data-action="play"]');
      if (playTarget) {
        selectActiveClip(playTarget.dataset.clipUid, true);
      }
    });

    // 10. 카테고리 탭 필터
    el.categoryTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.tab-btn');
      if (!tab) return;
      el.categoryTabs.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      tab.classList.add('active');
      state.currentFilter = tab.dataset.filter || 'ALL';
      state.visibleLimit = 24;
      renderClipsGrid();
    });

    // 11. 검색창 & 인기 키워드 칩
    el.inputSearch.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      state.visibleLimit = 24;
      el.btnClearSearch.classList.toggle('hidden', !state.searchQuery);
      renderClipsGrid();
    });

    el.btnClearSearch.addEventListener('click', () => {
      state.searchQuery = '';
      el.inputSearch.value = '';
      el.btnClearSearch.classList.add('hidden');
      el.quickKeywords.querySelectorAll('.keyword-chip').forEach((c) => c.classList.remove('active'));
      renderClipsGrid();
    });

    el.quickKeywords.addEventListener('click', (e) => {
      const chip = e.target.closest('.keyword-chip');
      if (!chip) return;
      const kw = chip.dataset.kw;
      if (state.searchQuery === kw) {
        state.searchQuery = '';
        el.inputSearch.value = '';
        chip.classList.remove('active');
      } else {
        state.searchQuery = kw;
        el.inputSearch.value = kw;
        el.quickKeywords.querySelectorAll('.keyword-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
      }
      el.btnClearSearch.classList.toggle('hidden', !state.searchQuery);
      state.visibleLimit = 24;
      renderClipsGrid();
    });

    // 12. 정렬 드롭다운 & 더보기 버튼
    el.selectSort.addEventListener('change', (e) => {
      state.currentSort = e.target.value;
      renderClipsGrid();
    });

    el.btnLoadMore.addEventListener('click', () => {
      state.visibleLimit += 24;
      renderClipsGrid();
    });
  }

  function navigateAdjacentClip(offset) {
    const list = getSortedFilteredClips();
    if (list.length === 0) return;
    const idx = list.findIndex((c) => c.clipUID === state.activeClipUID);
    const nextIdx = idx < 0 ? 0 : (idx + offset + list.length) % list.length;
    selectActiveClip(list[nextIdx].clipUID, false);
  }

  // 앱 부트스트랩
  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    initData();
  });
})();
