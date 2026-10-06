/**
 * 글 짓는 부엌 - 첨부 데이터 기반 일자별 베껴쓰기, 글쓰기 및 사용자 인증 스크립트
 * 기능:
 * 1. 베껴쓰기: A열 날짜에 해당하는 B열 내용을 매일 0시에 자동으로 화면에 반영
 * 2. 사용자 인증: 상단 이름 및 비밀번호(숫자 4자리) 입력 후 글쓰기 메뉴 활성화
 * 3. 글쓰기: 제목란과 내용란 분리 작성, 내가 쓴 글 제목 5줄 스크롤 리스트, 지난 글 보기 및 수정 기능
 * 4. 국립국어원 표준국어대사전 검색창 처리
 */

(function () {
  'use strict';

  // 첨부된 엑셀/CSV 데이터 목록 (A열: 날짜, B열: 내용)
  const writingSchedule = [
    {
      date: '2026-10-05',
      content: '산이 좋아 등산을 자주 갔다\n처음 등산화를 가졌을 때\n가슴에 파도가 왔다'
    },
    {
      date: '2026-10-06',
      content: '두루 명산을\n젖은 그늘로도 가고\n파랑새 날개로도 갔다'
    },
    {
      date: '2026-10-07',
      content: '무사히 하산하면\n수고 했어 고마워\n인사도 보냈다'
    },
    { date: '2026-10-08', content: '' },
    { date: '2026-10-09', content: '' },
    { date: '2026-10-10', content: '' },
    { date: '2026-10-11', content: '' },
    { date: '2026-10-12', content: '' }
  ];

  // 로컬 스토리지 키
  const STORAGE_KEY_POSTS = 'senior_kitchen_writings_v2';
  const STORAGE_KEY_USER = 'senior_kitchen_current_user_v2';

  // 베껴쓰기 DOM 요소
  const dateElement = document.getElementById('copywriting-date');
  const contentElement = document.getElementById('copywriting-content');

  // 사용자 인증 DOM 요소
  const authForm = document.getElementById('auth-form');
  const userNameInput = document.getElementById('user-name');
  const userPinInput = document.getElementById('user-pin');
  const authStatus = document.getElementById('auth-status');
  const authUserDisplay = document.getElementById('auth-user-display');
  const authLogoutBtn = document.getElementById('auth-logout-btn');

  // 글쓰기 섹션 DOM 요소
  const writingLockedView = document.getElementById('writing-locked-view');
  const writingUnlockedView = document.getElementById('writing-unlocked-view');
  const postForm = document.getElementById('post-form');
  const postTitleInput = document.getElementById('post-title');
  const postContentInput = document.getElementById('post-content');
  const userPostsList = document.getElementById('user-posts-list');

  // 지난 글 보기 및 수정 DOM 요소
  const postViewCard = document.getElementById('post-view-card');
  const postReadMode = document.getElementById('post-read-mode');
  const postEditMode = document.getElementById('post-edit-mode');
  const postViewTitle = document.getElementById('post-view-title');
  const postViewDate = document.getElementById('post-view-date');
  const postViewBody = document.getElementById('post-view-body');
  const btnEditPost = document.getElementById('btn-edit-post');
  const btnDeletePost = document.getElementById('btn-delete-post');
  const editPostTitle = document.getElementById('edit-post-title');
  const editPostContent = document.getElementById('edit-post-content');
  const btnSaveEdit = document.getElementById('btn-save-edit');
  const btnCancelEdit = document.getElementById('btn-cancel-edit');

  let lastLoadedDay = null;
  let currentUser = null; // { name: string, pin: string }
  let selectedPostId = null;

  /* ========================================================
     1. 베껴쓰기 (0시 자동 갱신)
     ======================================================== */
  function updateDailyContent() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    const yyyy = String(year);
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const todayKey = `${yyyy}-${mm}-${dd}`;
    const dateFormatted = `${year}년 ${month}월 ${day}일`;

    lastLoadedDay = day;

    if (dateElement) {
      dateElement.textContent = dateFormatted;
    }

    const matchedItem = writingSchedule.find(function (item) {
      return item.date === todayKey;
    });

    if (contentElement) {
      if (matchedItem && matchedItem.content && matchedItem.content.trim()) {
        contentElement.textContent = matchedItem.content.trim();
      } else {
        const validItems = writingSchedule.filter(function (item) {
          return item.content && item.content.trim();
        });
        if (validItems.length > 0) {
          contentElement.textContent = validItems[validItems.length - 1].content.trim();
        } else {
          contentElement.textContent = '';
        }
      }
    }
  }

  function scheduleMidnightUpdate() {
    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0, 0, 0, 500
    );

    const msUntilMidnight = Math.max(1000, nextMidnight.getTime() - now.getTime());

    setTimeout(function () {
      updateDailyContent();
      scheduleMidnightUpdate();
    }, msUntilMidnight);
  }

  function checkDayChange() {
    const currentDay = new Date().getDate();
    if (lastLoadedDay !== null && currentDay !== lastLoadedDay) {
      updateDailyContent();
    }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') checkDayChange();
  });
  window.addEventListener('focus', checkDayChange);
  setInterval(checkDayChange, 10000);

  /* ========================================================
     2. 사용자 인증 (이름, 비밀번호 숫자 4자리)
     ======================================================== */
  function getStoredUser() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_USER);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveStoredUser(user) {
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEY_USER);
      }
    } catch (e) {}
  }

  function setAuthState(user) {
    currentUser = user;
    selectedPostId = null;

    if (user) {
      if (authForm) authForm.style.display = 'none';
      if (authStatus) authStatus.style.display = 'flex';
      if (authUserDisplay) authUserDisplay.textContent = `${user.name}님`;

      if (writingLockedView) writingLockedView.style.display = 'none';
      if (writingUnlockedView) writingUnlockedView.style.display = 'block';

      renderUserPosts();
    } else {
      if (authForm) {
        authForm.style.display = 'flex';
        userNameInput.value = '';
        userPinInput.value = '';
      }
      if (authStatus) authStatus.style.display = 'none';

      if (writingLockedView) writingLockedView.style.display = 'block';
      if (writingUnlockedView) writingUnlockedView.style.display = 'none';

      if (userPostsList) userPostsList.innerHTML = '';
      if (postViewCard) postViewCard.style.display = 'none';
    }
  }

  function initAuth() {
    if (authForm) {
      authForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const name = userNameInput ? userNameInput.value.trim() : '';
        const pin = userPinInput ? userPinInput.value.trim() : '';

        if (!name) {
          alert('이름을 입력해 주세요.');
          if (userNameInput) userNameInput.focus();
          return;
        }

        if (!/^\d{4}$/.test(pin)) {
          alert('비밀번호는 숫자 4자리로 입력해 주세요.');
          if (userPinInput) {
            userPinInput.value = '';
            userPinInput.focus();
          }
          return;
        }

        const user = { name: name, pin: pin };
        saveStoredUser(user);
        setAuthState(user);
      });
    }

    if (authLogoutBtn) {
      authLogoutBtn.addEventListener('click', function () {
        saveStoredUser(null);
        setAuthState(null);
      });
    }

    const existingUser = getStoredUser();
    if (existingUser && existingUser.name && /^\d{4}$/.test(existingUser.pin)) {
      setAuthState(existingUser);
    } else {
      setAuthState(null);
    }
  }

  /* ========================================================
     3. 글쓰기 및 내가 쓴 글 (5줄 스크롤 리스트 & 수정 기능)
     ======================================================== */
  function getAllPosts() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_POSTS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveAllPosts(posts) {
    try {
      localStorage.setItem(STORAGE_KEY_POSTS, JSON.stringify(posts));
    } catch (e) {}
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 내가 쓴 글 제목 5줄 리스트 렌더링
   */
  function renderUserPosts() {
    if (!userPostsList || !currentUser) return;

    const allPosts = getAllPosts();
    const myPosts = allPosts.filter(function (post) {
      return post.author === currentUser.name && post.pin === currentUser.pin;
    });

    if (myPosts.length === 0) {
      userPostsList.innerHTML = '<li class="user-empty-posts">아직 작성한 글이 없습니다.</li>';
      if (postViewCard) postViewCard.style.display = 'none';
      selectedPostId = null;
      return;
    }

    // 선택된 글이 목록에 없으면 가장 최근 글을 기본 선택
    if (!selectedPostId || !myPosts.some(function (p) { return p.id === selectedPostId; })) {
      selectedPostId = myPosts[0].id;
    }

    let html = '';
    myPosts.forEach(function (post) {
      const isActive = post.id === selectedPostId ? ' active' : '';
      html += `
        <li class="user-post-item${isActive}" data-id="${post.id}">
          <span class="user-post-item-title">${escapeHtml(post.title || '제목 없음')}</span>
          <span class="user-post-item-date">${escapeHtml(post.createdAt)}</span>
        </li>
      `;
    });

    userPostsList.innerHTML = html;

    // 제목 클릭 시 지난 글 보기 이벤트 연결
    const items = userPostsList.querySelectorAll('.user-post-item');
    items.forEach(function (item) {
      item.addEventListener('click', function () {
        const id = item.getAttribute('data-id');
        selectedPostId = id;

        // active 클래스 업데이트
        items.forEach(function (el) { el.classList.remove('active'); });
        item.classList.add('active');

        renderPostDetail(selectedPostId);
      });
    });

    renderPostDetail(selectedPostId);
  }

  /**
   * 선택된 글 상세 보기 렌더링
   */
  function renderPostDetail(postId) {
    if (!postViewCard || !postId) return;

    const allPosts = getAllPosts();
    const post = allPosts.find(function (p) { return p.id === postId; });

    if (!post) {
      postViewCard.style.display = 'none';
      return;
    }

    postViewCard.style.display = 'block';

    // 읽기 모드로 초기화
    if (postReadMode) postReadMode.style.display = 'block';
    if (postEditMode) postEditMode.style.display = 'none';

    if (postViewTitle) postViewTitle.textContent = post.title || '제목 없음';
    if (postViewDate) postViewDate.textContent = post.createdAt;
    if (postViewBody) postViewBody.textContent = post.content || '';
  }

  /**
   * 지난 글 수정/삭제 메뉴 초기화
   */
  function initPostViewActions() {
    // [수정] 버튼 클릭 시 수정 모드로 전환
    if (btnEditPost) {
      btnEditPost.addEventListener('click', function () {
        if (!selectedPostId) return;

        const allPosts = getAllPosts();
        const post = allPosts.find(function (p) { return p.id === selectedPostId; });
        if (!post) return;

        if (editPostTitle) editPostTitle.value = post.title || '';
        if (editPostContent) editPostContent.value = post.content || '';

        if (postReadMode) postReadMode.style.display = 'none';
        if (postEditMode) postEditMode.style.display = 'block';

        if (editPostTitle) editPostTitle.focus();
      });
    }

    // [취소] 버튼 클릭 시 읽기 모드로 복귀
    if (btnCancelEdit) {
      btnCancelEdit.addEventListener('click', function () {
        if (postReadMode) postReadMode.style.display = 'block';
        if (postEditMode) postEditMode.style.display = 'none';
      });
    }

    // [저장] 버튼 클릭 시 수정 내용 반영
    if (btnSaveEdit) {
      btnSaveEdit.addEventListener('click', function () {
        if (!selectedPostId) return;

        const newTitle = editPostTitle ? editPostTitle.value.trim() : '';
        const newContent = editPostContent ? editPostContent.value.trim() : '';

        if (!newTitle) {
          alert('제목을 입력해 주세요.');
          if (editPostTitle) editPostTitle.focus();
          return;
        }

        if (!newContent) {
          alert('내용을 입력해 주세요.');
          if (editPostContent) editPostContent.focus();
          return;
        }

        const allPosts = getAllPosts();
        const postIndex = allPosts.findIndex(function (p) { return p.id === selectedPostId; });

        if (postIndex !== -1) {
          allPosts[postIndex].title = newTitle;
          allPosts[postIndex].content = newContent;
          saveAllPosts(allPosts);
        }

        renderUserPosts();
        renderPostDetail(selectedPostId);
      });
    }

    // [삭제] 버튼 클릭 시 글 삭제
    if (btnDeletePost) {
      btnDeletePost.addEventListener('click', function () {
        if (!selectedPostId) return;

        if (confirm('이 글을 삭제하시겠습니까?')) {
          const allPosts = getAllPosts();
          const updated = allPosts.filter(function (p) { return p.id !== selectedPostId; });
          saveAllPosts(updated);

          selectedPostId = null;
          renderUserPosts();
        }
      });
    }
  }

  /**
   * 새 글 등록 초기화 (제목, 내용 분리)
   */
  function initWriting() {
    if (!postForm) return;

    postForm.addEventListener('submit', function (e) {
      e.preventDefault();

      if (!currentUser) {
        alert('상단에서 이름과 비밀번호(숫자 4자리)를 먼저 입력해 주세요.');
        return;
      }

      const title = postTitleInput ? postTitleInput.value.trim() : '';
      const content = postContentInput ? postContentInput.value.trim() : '';

      if (!title) {
        alert('제목을 입력해 주세요.');
        if (postTitleInput) postTitleInput.focus();
        return;
      }

      if (!content) {
        alert('내용을 입력해 주세요.');
        if (postContentInput) postContentInput.focus();
        return;
      }

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const createdAt = `${year}년 ${month}월 ${day}일 ${hours}:${minutes}`;

      const newPost = {
        id: 'post_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        author: currentUser.name,
        pin: currentUser.pin,
        title: title,
        content: content,
        createdAt: createdAt
      };

      const allPosts = getAllPosts();
      allPosts.unshift(newPost); // 최신 글이 맨 위로
      saveAllPosts(allPosts);

      if (postTitleInput) postTitleInput.value = '';
      if (postContentInput) postContentInput.value = '';

      selectedPostId = newPost.id;
      renderUserPosts();

      // 등록한 글 보기 카드로 부드럽게 스크롤 이동
      if (postViewCard) {
        postViewCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  /* ========================================================
     4. 국립국어원 표준국어대사전 검색창 제출 처리
     ======================================================== */
  function initDictSearch() {
    const dictForm = document.querySelector('.dict-search-form');
    if (!dictForm) return;

    dictForm.addEventListener('submit', function (e) {
      const input = dictForm.querySelector('input[name="searchKeyword"]');
      const keyword = input ? input.value.trim() : '';

      if (!keyword) {
        e.preventDefault();
        window.open('https://stdict.korean.go.kr/search/searchResult.do', '_blank');
      }
    });
  }

  // 초기 실행
  document.addEventListener('DOMContentLoaded', function () {
    updateDailyContent();
    scheduleMidnightUpdate();
    initAuth();
    initWriting();
    initPostViewActions();
    initDictSearch();
  });
})();
