/**
 * 글 짓는 부엌 - 첨부 데이터 기반 일자별 베껴쓰기, 글쓰기 및 사용자 인증 스크립트
 * 기능:
 * 1. 베껴쓰기: A열 날짜에 해당하는 B열 내용을 매일 0시에 자동으로 화면에 반영
 * 2. 사용자 인증 및 자동 출석체크: 상단 이름/비밀번호 입력 시 자동 출석 기록
 * 3. 관리자 출석부: 관리자(예성원/8797) 로그인 시에만 엑셀 양식의 출석체크 양식(날짜, 이름, 비번, 누적 출석 횟수) 노출
 * 4. 글쓰기: 제목란/내용란 분리 작성, 내가 쓴 글 제목 5줄 스크롤 리스트, 지난 글 보기 및 수정/삭제
 * 5. 국립국어원 표준국어대사전 검색창 처리
 */

(function () {
  'use strict';

  // 관리자 계정 정보
  const ADMIN_NAME = '예성원';
  const ADMIN_PIN = '8797';

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
    {
      date: '2026-10-08',
      content: '희디 희게 사위어가며 사랑을 할 것이다.'
    },
    {
      date: '2026-10-09',
      content: '가슴에 불잉걸을 보듬어야 할 절박한 까닭이다.'
    },
    { date: '2026-10-10', content: '' },
    { date: '2026-10-11', content: '' },
    { date: '2026-10-12', content: '' }
  ];

  // 로컬 스토리지 키
  const STORAGE_KEY_POSTS = 'senior_kitchen_writings_v2';
  const STORAGE_KEY_USER = 'senior_kitchen_current_user_v2';
  const STORAGE_KEY_ATTENDANCE = 'senior_kitchen_attendance_v2';
  const STORAGE_KEY_CLOUD_URL = 'senior_kitchen_cloud_url_v2';
  const DEFAULT_CLOUD_URL = 'https://senior-kitchen-default-rtdb.firebaseio.com';

  // 베껴쓰기 DOM 요소
  const dateElement = document.getElementById('copywriting-date');
  const contentElement = document.getElementById('copywriting-content');

  // 사용자 인증 DOM 요소
  const userAuthBar = document.getElementById('user-auth-bar') || document.querySelector('.user-auth-bar');
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

  // 관리자 전용 출석체크 및 회원 글 모음 DOM 요소
  const adminAttendanceSection = document.getElementById('admin-attendance');
  const adminNavItem = document.getElementById('admin-nav-item');
  const attendanceTableBody = document.getElementById('attendance-table-body');
  const btnDownloadAttendance = document.getElementById('btn-download-attendance');

  const adminPostsSection = document.getElementById('admin-posts');
  const adminPostsNavItem = document.getElementById('admin-posts-nav-item');
  const adminPostsTableBody = document.getElementById('admin-posts-table-body');
  const btnDownloadPostsTxt = document.getElementById('btn-download-posts-txt');
  const btnDownloadPostsCsv = document.getElementById('btn-download-posts-csv');

  // 기기 간 실시간 동기화 DOM 요소
  const syncIndicatorDot = document.getElementById('sync-indicator-dot');
  const syncStatusText = document.getElementById('sync-status-text');
  const btnSyncNow = document.getElementById('btn-sync-now');
  const btnSyncSettings = document.getElementById('btn-sync-settings');
  const btnSyncBackup = document.getElementById('btn-sync-backup');
  const syncSettingsPanel = document.getElementById('sync-settings-panel');
  const syncBackupPanel = document.getElementById('sync-backup-panel');
  const cloudDbUrlInput = document.getElementById('cloud-db-url-input');
  const btnSaveSyncUrl = document.getElementById('btn-save-sync-url');
  const btnResetSyncUrl = document.getElementById('btn-reset-sync-url');
  const btnExportBackup = document.getElementById('btn-export-backup');
  const inputImportBackup = document.getElementById('input-import-backup');

  let adminSyncTimer = null;
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
     2. 사용자 인증 및 자동 출석체크
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

  function isAdmin(user) {
    return user && user.name === ADMIN_NAME && user.pin === ADMIN_PIN;
  }

  /**
   * 출석 기록 불러오기 및 저장
   */
  function getAttendanceRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ATTENDANCE);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveAttendanceRecords(records) {
    try {
      localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(records));
    } catch (e) {}
  }

  /**
   * 이름과 비밀번호 입력 시 자동 출석체크 수행
   * 양식: 날짜, 이름, 비번, 누적 출석 횟수
   */
  function recordAttendance(user) {
    if (!user || !user.name || !user.pin) return;

    const records = getAttendanceRecords();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayDateStr = `${year}-${month}-${day}`;

    // 해당 사용자가 오늘 이미 출석체크 되었는지 확인
    const alreadyAttendedToday = records.some(function (r) {
      return r.name === user.name && r.pin === user.pin && r.date === todayDateStr;
    });

    if (!alreadyAttendedToday) {
      // 해당 사용자의 이전 고유 출석일수 계산
      const userPastDates = new Set();
      records.forEach(function (r) {
        if (r.name === user.name && r.pin === user.pin) {
          userPastDates.add(r.date);
        }
      });
      const newCount = userPastDates.size + 1;

      const newRecord = {
        date: todayDateStr,
        name: user.name,
        pin: user.pin,
        count: newCount,
        timestamp: Date.now()
      };

      records.push(newRecord);
      saveAttendanceRecords(records);
      cloudPushAttendance(newRecord);
    }
  }

  /**
   * 관리자 출석체크 테이블 렌더링 (날짜, 이름, 비번, 누적 출석 횟수, 삭제 버튼)
   */
  function renderAdminAttendanceTable() {
    if (!attendanceTableBody) return;

    const records = getAttendanceRecords();
    if (records.length === 0) {
      attendanceTableBody.innerHTML = '<tr><td colspan="5" class="attendance-empty-row">출석 기록이 없습니다.</td></tr>';
      return;
    }

    let html = '';
    records.forEach(function (rec, index) {
      html += `
        <tr>
          <td>${escapeHtml(rec.date)}</td>
          <td>${escapeHtml(rec.name)}</td>
          <td>${escapeHtml(rec.pin)}</td>
          <td>${rec.count}</td>
          <td><button type="button" class="btn-row-delete" data-index="${index}">삭제</button></td>
        </tr>
      `;
    });
    attendanceTableBody.innerHTML = html;

    // 각 행 삭제 버튼 이벤트 바인딩
    const deleteBtns = attendanceTableBody.querySelectorAll('.btn-row-delete');
    deleteBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        if (confirm('해당 출석 기록을 삭제하시겠습니까?')) {
          deleteAttendanceRecord(idx);
        }
      });
    });
  }

  function deleteAttendanceRecord(index) {
    const records = getAttendanceRecords();
    if (index >= 0 && index < records.length) {
      records.splice(index, 1);
      saveAttendanceRecords(records);
      renderAdminAttendanceTable();
      cloudSyncAllAttendance(records);
    }
  }

  /**
   * 출석부 CSV 다운로드 기능
   */
  function initAttendanceDownload() {
    if (!btnDownloadAttendance) return;

    btnDownloadAttendance.addEventListener('click', function () {
      const records = getAttendanceRecords();
      let csvContent = '\uFEFF날짜,이름,비번,누적 출석 횟수\n';

      records.forEach(function (r) {
        const cleanName = String(r.name).replace(/"/g, '""');
        const cleanPin = String(r.pin).replace(/"/g, '""');
        csvContent += `"${r.date}","${cleanName}","${cleanPin}",${r.count}\n`;
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `출석부_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }

  /**
   * 관리자 회원 글 모음 테이블 렌더링
   */
  function renderAdminPostsTable() {
    if (!adminPostsTableBody) return;

    const allPosts = getAllPosts();
    if (allPosts.length === 0) {
      adminPostsTableBody.innerHTML = '<tr><td colspan="5" class="admin-posts-empty-row">작성된 회원 글이 없습니다.</td></tr>';
      return;
    }

    let html = '';
    allPosts.forEach(function (post, index) {
      const num = allPosts.length - index;
      const title = escapeHtml(post.title || '제목 없음');
      const author = escapeHtml(post.author || '익명');
      const date = escapeHtml(post.createdAt || '');
      const content = escapeHtml(post.content || '');
      const cleanContentTooltip = (post.content || '').replace(/"/g, '&quot;');

      html += `
        <tr>
          <td class="cell-num">${num}</td>
          <td class="cell-date">${date}</td>
          <td class="cell-author">${author}</td>
          <td class="cell-title" title="${title}">${title}</td>
          <td class="cell-content" title="${cleanContentTooltip}">${content}</td>
        </tr>
      `;
    });

    adminPostsTableBody.innerHTML = html;
  }

  /**
   * 관리자 회원 글 모음 한 문서 다운로드 (.txt 및 .csv)
   */
  function initAdminPostsDownload() {
    if (btnDownloadPostsTxt) {
      btnDownloadPostsTxt.addEventListener('click', function () {
        const allPosts = getAllPosts();
        if (allPosts.length === 0) {
          alert('다운로드할 회원 글이 없습니다.');
          return;
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const downloadTime = `${year}-${month}-${day} ${hours}:${minutes}`;

        let docContent = '\uFEFF';
        docContent += '==================================================\n';
        docContent += '글 짓는 부엌 - 회원 글 모음\n';
        docContent += `다운로드 일시: ${downloadTime}\n`;
        docContent += `총 작성 글 수: ${allPosts.length}편\n`;
        docContent += '==================================================\n\n';

        allPosts.forEach(function (post, idx) {
          docContent += `[글 ${idx + 1}]\n`;
          docContent += `- 작성자: ${post.author || '익명'}\n`;
          docContent += `- 작성일시: ${post.createdAt || ''}\n`;
          docContent += `- 제목: ${post.title || '제목 없음'}\n`;
          docContent += `- 내용:\n${post.content || ''}\n`;
          docContent += '\n--------------------------------------------------\n\n';
        });

        const blob = new Blob([docContent], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `회원_글_모음_${year}-${month}-${day}.txt`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      });
    }

    if (btnDownloadPostsCsv) {
      btnDownloadPostsCsv.addEventListener('click', function () {
        const allPosts = getAllPosts();
        if (allPosts.length === 0) {
          alert('다운로드할 회원 글이 없습니다.');
          return;
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        let csvContent = '\uFEFF번호,작성일시,작성자,제목,내용\n';

        allPosts.forEach(function (post, idx) {
          const num = allPosts.length - idx;
          const cleanDate = String(post.createdAt || '').replace(/"/g, '""');
          const cleanAuthor = String(post.author || '').replace(/"/g, '""');
          const cleanTitle = String(post.title || '').replace(/"/g, '""');
          const cleanContent = String(post.content || '').replace(/"/g, '""');

          csvContent += `${num},"${cleanDate}","${cleanAuthor}","${cleanTitle}","${cleanContent}"\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `회원_글_모음_${year}-${month}-${day}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      });
    }
  }

  /* ========================================================
     기기 간 실시간 동기화 (PC · 모바일폰 연동 엔진)
     ======================================================== */
  function getCloudUrl() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CLOUD_URL);
      return (saved || DEFAULT_CLOUD_URL).trim().replace(/\/+$/, '');
    } catch (e) {
      return DEFAULT_CLOUD_URL;
    }
  }

  function setCloudUrl(url) {
    try {
      if (url && url.trim()) {
        localStorage.setItem(STORAGE_KEY_CLOUD_URL, url.trim().replace(/\/+$/, ''));
      } else {
        localStorage.removeItem(STORAGE_KEY_CLOUD_URL);
      }
    } catch (e) {}
  }

  function setSyncStatus(state, message) {
    if (syncStatusText) syncStatusText.textContent = message;
    if (syncIndicatorDot) {
      if (state === 'syncing') {
        syncIndicatorDot.className = 'sync-indicator-dot syncing';
        syncIndicatorDot.style.backgroundColor = '#F39C12';
      } else if (state === 'error') {
        syncIndicatorDot.className = 'sync-indicator-dot';
        syncIndicatorDot.style.backgroundColor = '#E74C3C';
      } else {
        syncIndicatorDot.className = 'sync-indicator-dot';
        syncIndicatorDot.style.backgroundColor = '#27AE60';
      }
    }
  }

  function cloudPushAttendance(record) {
    const url = getCloudUrl();
    if (!url) return;
    try {
      fetch(`${url}/attendance.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      }).catch(function () {});
    } catch (e) {}
  }

  function cloudSyncAllAttendance(records) {
    const url = getCloudUrl();
    if (!url) return;
    try {
      fetch(`${url}/attendance.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(records)
      }).catch(function () {});
    } catch (e) {}
  }

  function cloudPushPost(post) {
    const url = getCloudUrl();
    if (!url) return;
    try {
      fetch(`${url}/posts/${post.id}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(post)
      }).catch(function () {});
    } catch (e) {}
  }

  function cloudDeletePost(postId) {
    const url = getCloudUrl();
    if (!url) return;
    try {
      fetch(`${url}/posts/${postId}.json`, {
        method: 'DELETE'
      }).catch(function () {});
    } catch (e) {}
  }

  function cloudSyncAllPosts(posts) {
    const url = getCloudUrl();
    if (!url) return;
    try {
      const postsObj = {};
      posts.forEach(p => { postsObj[p.id] = p; });
      fetch(`${url}/posts.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postsObj)
      }).catch(function () {});
    } catch (e) {}
  }

  /**
   * 다른 기기(PC, 모바일폰)에서 등록된 출석과 글을 클라우드에서 가져와 병합
   */
  async function fetchAndMergeCloudData(isManual) {
    const url = getCloudUrl();
    if (!url) {
      setSyncStatus('idle', '로컬 저장소 모드 (클라우드 DB 미연결)');
      return;
    }

    setSyncStatus('syncing', '다른 기기(PC, 모바일) 데이터 동기화 중...');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500);

      const [attRes, postRes] = await Promise.all([
        fetch(`${url}/attendance.json`, { signal: controller.signal }).catch(() => null),
        fetch(`${url}/posts.json`, { signal: controller.signal }).catch(() => null)
      ]);
      clearTimeout(timeoutId);

      let attUpdated = false;
      let postUpdated = false;

      // 1. 출석체크 병합
      if (attRes && attRes.ok) {
        const attData = await attRes.json();
        if (attData) {
          const cloudRecords = Array.isArray(attData) ? attData.filter(Boolean) : Object.values(attData);
          const localRecords = getAttendanceRecords();
          const map = new Map();

          localRecords.forEach(r => {
            if (r && r.date && r.name && r.pin) {
              map.set(`${r.date}__${r.name}__${r.pin}`, r);
            }
          });

          cloudRecords.forEach(r => {
            if (r && r.date && r.name && r.pin) {
              const key = `${r.date}__${r.name}__${r.pin}`;
              if (!map.has(key)) {
                map.set(key, r);
                attUpdated = true;
              } else {
                const existing = map.get(key);
                if ((r.count || 0) > (existing.count || 0)) {
                  map.set(key, r);
                  attUpdated = true;
                }
              }
            }
          });

          if (attUpdated) {
            const mergedAtt = Array.from(map.values());
            saveAttendanceRecords(mergedAtt);
          }
        }
      }

      // 2. 회원 글 병합
      if (postRes && postRes.ok) {
        const postData = await postRes.json();
        if (postData) {
          const cloudPosts = Array.isArray(postData) ? postData.filter(Boolean) : Object.values(postData);
          const localPosts = getAllPosts();
          const postMap = new Map();

          localPosts.forEach(p => { if (p && p.id) postMap.set(p.id, p); });

          cloudPosts.forEach(p => {
            if (p && p.id && p.title) {
              if (!postMap.has(p.id)) {
                postMap.set(p.id, p);
                postUpdated = true;
              }
            }
          });

          if (postUpdated) {
            const mergedPosts = Array.from(postMap.values());
            mergedPosts.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            saveAllPosts(mergedPosts);
          }
        }
      }

      if (isAdmin(currentUser)) {
        renderAdminAttendanceTable();
        renderAdminPostsTable();
      }

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      setSyncStatus('success', `다른 기기(PC, 모바일)와 최신 상태로 동기화 완료 (${timeStr})`);

      if (isManual) {
        alert('다른 기기(PC, 모바일폰)의 최신 출석 및 회원 글과 성공적으로 동기화되었습니다.');
      }
    } catch (err) {
      setSyncStatus('idle', '로컬 저장소 모드 (클라우드 DB 연결 대기 중)');
      if (isManual) {
        alert('클라우드 DB와의 연결 상태를 확인해 주세요. [클라우드 DB 설정]에서 Firebase URL을 확인하거나 수동 백업 기능을 이용하실 수 있습니다.');
      }
    }
  }

  function startAdminCloudSync() {
    if (adminSyncTimer) clearInterval(adminSyncTimer);
    fetchAndMergeCloudData(false);
    adminSyncTimer = setInterval(function () {
      fetchAndMergeCloudData(false);
    }, 15000);
  }

  function stopAdminCloudSync() {
    if (adminSyncTimer) {
      clearInterval(adminSyncTimer);
      adminSyncTimer = null;
    }
  }

  function setAuthState(user) {
    currentUser = user;
    selectedPostId = null;

    if (user) {
      // 1. 자동 출석체크 수행
      recordAttendance(user);

      // 상단 바 분홍색 전환
      if (userAuthBar) userAuthBar.classList.add('logged-in');

      if (authForm) authForm.style.display = 'none';
      if (authStatus) authStatus.style.display = 'flex';
      if (authUserDisplay) authUserDisplay.textContent = `${user.name}님`;

      if (writingLockedView) writingLockedView.style.display = 'none';
      if (writingUnlockedView) writingUnlockedView.style.display = 'block';

      renderUserPosts();

      // 2. 관리자(예성원/8797) 로그인 시에만 출석체크 및 회원 글 모음 노출
      if (isAdmin(user)) {
        if (adminAttendanceSection) adminAttendanceSection.style.display = 'block';
        if (adminNavItem) adminNavItem.style.display = 'inline-block';
        if (adminPostsSection) adminPostsSection.style.display = 'block';
        if (adminPostsNavItem) adminPostsNavItem.style.display = 'inline-block';
        renderAdminAttendanceTable();
        renderAdminPostsTable();
        startAdminCloudSync();
      } else {
        if (adminAttendanceSection) adminAttendanceSection.style.display = 'none';
        if (adminNavItem) adminNavItem.style.display = 'none';
        if (adminPostsSection) adminPostsSection.style.display = 'none';
        if (adminPostsNavItem) adminPostsNavItem.style.display = 'none';
        stopAdminCloudSync();
      }
    } else {
      // 상단 바 원래 색 복원
      if (userAuthBar) userAuthBar.classList.remove('logged-in');

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

      if (adminAttendanceSection) adminAttendanceSection.style.display = 'none';
      if (adminNavItem) adminNavItem.style.display = 'none';
      if (adminPostsSection) adminPostsSection.style.display = 'none';
      if (adminPostsNavItem) adminPostsNavItem.style.display = 'none';
      stopAdminCloudSync();
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

    const items = userPostsList.querySelectorAll('.user-post-item');
    items.forEach(function (item) {
      item.addEventListener('click', function () {
        const id = item.getAttribute('data-id');
        selectedPostId = id;

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

    if (btnCancelEdit) {
      btnCancelEdit.addEventListener('click', function () {
        if (postReadMode) postReadMode.style.display = 'block';
        if (postEditMode) postEditMode.style.display = 'none';
      });
    }

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
          cloudPushPost(allPosts[postIndex]);
        }

        renderUserPosts();
        renderPostDetail(selectedPostId);
        if (isAdmin(currentUser)) renderAdminPostsTable();
      });
    }

    if (btnDeletePost) {
      btnDeletePost.addEventListener('click', function () {
        if (!selectedPostId) return;

        if (confirm('이 글을 삭제하시겠습니까?')) {
          const allPosts = getAllPosts();
          const targetId = selectedPostId;
          const updated = allPosts.filter(function (p) { return p.id !== targetId; });
          saveAllPosts(updated);
          cloudDeletePost(targetId);

          selectedPostId = null;
          renderUserPosts();
          if (isAdmin(currentUser)) renderAdminPostsTable();
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
      allPosts.unshift(newPost);
      saveAllPosts(allPosts);
      cloudPushPost(newPost);

      if (postTitleInput) postTitleInput.value = '';
      if (postContentInput) postContentInput.value = '';

      selectedPostId = newPost.id;
      renderUserPosts();
      if (isAdmin(currentUser)) renderAdminPostsTable();

      if (postViewCard) {
        postViewCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  /**
   * 기기 간 동기화 제어 버튼 및 패널 이벤트 초기화
   */
  function initSyncControls() {
    if (cloudDbUrlInput) {
      cloudDbUrlInput.value = getCloudUrl();
    }

    if (btnSyncNow) {
      btnSyncNow.addEventListener('click', function () {
        fetchAndMergeCloudData(true);
      });
    }

    if (btnSyncSettings) {
      btnSyncSettings.addEventListener('click', function () {
        if (!syncSettingsPanel) return;
        const isHidden = syncSettingsPanel.style.display === 'none';
        syncSettingsPanel.style.display = isHidden ? 'block' : 'none';
        if (syncBackupPanel) syncBackupPanel.style.display = 'none';
      });
    }

    if (btnSaveSyncUrl) {
      btnSaveSyncUrl.addEventListener('click', function () {
        const url = cloudDbUrlInput ? cloudDbUrlInput.value.trim() : '';
        setCloudUrl(url);
        alert('클라우드 데이터베이스 주소가 저장되었습니다. 지금 동기화를 시도합니다.');
        fetchAndMergeCloudData(true);
      });
    }

    if (btnResetSyncUrl) {
      btnResetSyncUrl.addEventListener('click', function () {
        setCloudUrl(DEFAULT_CLOUD_URL);
        if (cloudDbUrlInput) cloudDbUrlInput.value = DEFAULT_CLOUD_URL;
        alert('기본 클라우드 주소로 복원되었습니다.');
        fetchAndMergeCloudData(true);
      });
    }

    if (btnSyncBackup) {
      btnSyncBackup.addEventListener('click', function () {
        if (!syncBackupPanel) return;
        const isHidden = syncBackupPanel.style.display === 'none';
        syncBackupPanel.style.display = isHidden ? 'block' : 'none';
        if (syncSettingsPanel) syncSettingsPanel.style.display = 'none';
      });
    }

    if (btnExportBackup) {
      btnExportBackup.addEventListener('click', function () {
        const backupData = {
          version: 'senior_kitchen_v2',
          exportedAt: new Date().toISOString(),
          attendance: getAttendanceRecords(),
          posts: getAllPosts()
        };
        const jsonStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `글짓는부엌_데이터백업_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      });
    }

    if (inputImportBackup) {
      inputImportBackup.addEventListener('change', function (e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (evt) {
          try {
            const data = JSON.parse(evt.target.result);
            if (!data.attendance && !data.posts) {
              alert('올바른 백업 파일 형식이 아닙니다.');
              return;
            }

            let importedAttCount = 0;
            let importedPostCount = 0;

            if (Array.isArray(data.attendance)) {
              const localAtt = getAttendanceRecords();
              const map = new Map();
              localAtt.forEach(function (r) { map.set(`${r.date}__${r.name}__${r.pin}`, r); });
              data.attendance.forEach(function (r) {
                if (r && r.date && r.name && r.pin) {
                  const key = `${r.date}__${r.name}__${r.pin}`;
                  if (!map.has(key) || ((r.count || 0) > (map.get(key).count || 0))) {
                    map.set(key, r);
                    importedAttCount++;
                  }
                }
              });
              const mergedAtt = Array.from(map.values());
              saveAttendanceRecords(mergedAtt);
              cloudSyncAllAttendance(mergedAtt);
            }

            if (Array.isArray(data.posts)) {
              const localPosts = getAllPosts();
              const postMap = new Map();
              localPosts.forEach(function (p) { postMap.set(p.id, p); });
              data.posts.forEach(function (p) {
                if (p && p.id && p.title) {
                  if (!postMap.has(p.id)) {
                    postMap.set(p.id, p);
                    importedPostCount++;
                  }
                }
              });
              const mergedPosts = Array.from(postMap.values());
              saveAllPosts(mergedPosts);
              cloudSyncAllPosts(mergedPosts);
            }

            if (isAdmin(currentUser)) {
              renderAdminAttendanceTable();
              renderAdminPostsTable();
            }

            alert(`데이터 복원이 완료되었습니다.\n- 출석 기록: ${importedAttCount}건 반영\n- 회원 글: ${importedPostCount}편 반영`);
          } catch (err) {
            alert('파일을 읽는 중 오류가 발생했습니다: ' + err.message);
          }
        };
        reader.readAsText(file, 'utf-8');
      });
    }
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
    initAttendanceDownload();
    initAdminPostsDownload();
    initSyncControls();
    initDictSearch();
  });
})();
