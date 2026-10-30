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
  const ADMIN_DISPLAY_NAME = '관리자';
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
  const STORAGE_KEY_COPYWRITING = 'senior_kitchen_copywriting_v2';
  const STORAGE_KEY_POSTS = 'senior_kitchen_writings_v2';
  const STORAGE_KEY_USER = 'senior_kitchen_current_user_v2';
  const STORAGE_KEY_ATTENDANCE = 'senior_kitchen_attendance_v2';
  const STORAGE_KEY_CLOUD_URL = 'senior_kitchen_cloud_url_v2';
  const STORAGE_KEY_PHOTOS = 'senior_kitchen_photos_v2';
  const STORAGE_KEY_QNA = 'senior_kitchen_qna_v2';
  const DEFAULT_CLOUD_URL = 'https://mywork-f631b-default-rtdb.firebaseio.com';

  // 베껴쓰기 DOM 요소
  const dateElement = document.getElementById('copywriting-date');
  const contentElement = document.getElementById('copywriting-content');
  const adminCopywritingManager = document.getElementById('admin-copywriting-manager');
  const copywritingAdminForm = document.getElementById('copywriting-admin-form');
  const copywritingInputDate = document.getElementById('copywriting-input-date');
  const copywritingInputContent = document.getElementById('copywriting-input-content');
  const btnSaveCopywriting = document.getElementById('btn-save-copywriting');
  const btnCancelCopywriting = document.getElementById('btn-cancel-copywriting');
  const copywritingListCount = document.getElementById('copywriting-list-count');
  const copywritingTableBody = document.getElementById('copywriting-table-body');

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
  const btnTestFirebase = document.getElementById('btn-test-firebase');
  const btnTestFirebasePanel = document.getElementById('btn-test-firebase-panel');
  const btnUploadAllCloud = document.getElementById('btn-upload-all-cloud');
  const firebaseDiagnosisBox = document.getElementById('firebase-diagnosis-box');
  const btnCopyRulesCode = document.getElementById('btn-copy-rules-code');
  const btnSyncSettings = document.getElementById('btn-sync-settings');
  const btnSyncBackup = document.getElementById('btn-sync-backup');
  const syncSettingsPanel = document.getElementById('sync-settings-panel');
  const syncBackupPanel = document.getElementById('sync-backup-panel');
  const cloudDbUrlInput = document.getElementById('cloud-db-url-input');
  const btnSaveSyncUrl = document.getElementById('btn-save-sync-url');
  const btnResetSyncUrl = document.getElementById('btn-reset-sync-url');
  const btnExportBackup = document.getElementById('btn-export-backup');
  const inputImportBackup = document.getElementById('input-import-backup');

  // 사진첩 DOM 요소
  const photoUploadForm = document.getElementById('photo-upload-form');
  const photoFileInput = document.getElementById('photo-file-input');
  const photoFileLabelText = document.getElementById('photo-file-label-text');
  const photoPreviewBox = document.getElementById('photo-preview-box');
  const photoPreviewImg = document.getElementById('photo-preview-img');
  const photoCompressBadge = document.getElementById('photo-compress-badge');
  const statSizeHighlight = document.getElementById('stat-size-highlight');
  const statSizeDetail = document.getElementById('stat-size-detail');
  const photoTitleInput = document.getElementById('photo-title-input');
  const photoAuthorInput = document.getElementById('photo-author-input');
  const photoPinInput = document.getElementById('photo-pin-input');
  const btnSubmitPhoto = document.getElementById('btn-submit-photo');
  const btnCancelPhoto = document.getElementById('btn-cancel-photo');
  const photoGalleryGrid = document.getElementById('photo-gallery-grid');
  const photoGalleryEmpty = document.getElementById('photo-gallery-empty');
  const photoGalleryCount = document.getElementById('photo-gallery-count');
  const photoModal = document.getElementById('photo-modal');
  const photoModalImg = document.getElementById('photo-modal-img');
  const photoModalTitle = document.getElementById('photo-modal-title');
  const photoModalMeta = document.getElementById('photo-modal-meta');
  const photoModalClose = document.getElementById('photo-modal-close');
  const photoModalBackdrop = document.getElementById('photo-modal-backdrop');

  // 질문과 답 (Q&A) DOM 요소
  const qnaForm = document.getElementById('qna-form');
  const qnaNameInput = document.getElementById('qna-name-input');
  const qnaPinInput = document.getElementById('qna-pin-input');
  const qnaTitleInput = document.getElementById('qna-title-input');
  const qnaContentInput = document.getElementById('qna-content-input');
  const qnaItemsList = document.getElementById('qna-items-list');
  const qnaEmptyView = document.getElementById('qna-empty-view');
  const qnaListCount = document.getElementById('qna-list-count');
  const qnaAnswerModal = document.getElementById('qna-answer-modal');
  const qnaAnswerBackdrop = document.getElementById('qna-answer-backdrop');
  const qnaAnswerClose = document.getElementById('qna-answer-close');
  const qnaModalQTitle = document.getElementById('qna-modal-q-title');
  const qnaModalQContent = document.getElementById('qna-modal-q-content');
  const qnaModalAnswerInput = document.getElementById('qna-modal-answer-input');
  const btnSaveQnaAnswer = document.getElementById('btn-save-qna-answer');
  const btnDeleteQnaAnswer = document.getElementById('btn-delete-qna-answer');
  const btnCancelQnaAnswer = document.getElementById('btn-cancel-qna-answer');

  // 질문 수정 모달 (작성자 또는 관리자 전용) DOM 요소
  const qnaEditModal = document.getElementById('qna-edit-modal');
  const qnaEditBackdrop = document.getElementById('qna-edit-backdrop');
  const qnaEditClose = document.getElementById('qna-edit-close');
  const qnaEditMetaAuthor = document.getElementById('qna-edit-meta-author');
  const qnaEditMetaDate = document.getElementById('qna-edit-meta-date');
  const qnaEditTitleInput = document.getElementById('qna-edit-title-input');
  const qnaEditContentInput = document.getElementById('qna-edit-content-input');
  const btnSaveQnaEdit = document.getElementById('btn-save-qna-edit');
  const btnCancelQnaEdit = document.getElementById('btn-cancel-qna-edit');
  let editingQnaId = null;

  // 관리자 전용 회원 글 수정 모달 DOM 요소
  const adminPostEditModal = document.getElementById('admin-post-edit-modal');
  const adminPostEditBackdrop = document.getElementById('admin-post-edit-backdrop');
  const adminPostEditClose = document.getElementById('admin-post-edit-close');
  const adminPostMetaAuthor = document.getElementById('admin-post-meta-author');
  const adminPostMetaDate = document.getElementById('admin-post-meta-date');
  const adminEditPostTitle = document.getElementById('admin-edit-post-title');
  const adminEditPostContent = document.getElementById('admin-edit-post-content');
  const btnSaveAdminPost = document.getElementById('btn-save-admin-post');
  const btnCancelAdminPost = document.getElementById('btn-cancel-admin-post');

  let adminSyncTimer = null;
  let lastLoadedDay = null;
  let currentUser = null; // { name: string, pin: string }
  let selectedPostId = null;
  let currentCompressedPhoto = null; // { dataUrl, width, height, originalBytes, compressedBytes }
  let answeringQnaId = null; // 현재 관리자가 답변 중인 Q&A ID
  let editingAdminPostId = null; // 현재 관리자가 수정 중인 회원 글 ID

  /* ========================================================
     1. 베껴쓰기 (0시 자동 갱신 & 관리자 직접 입력·수정·삭제)
     ======================================================== */
  function getTodayKey() {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function formatDateKorean(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parseInt(parts[0], 10)}년 ${parseInt(parts[1], 10)}월 ${parseInt(parts[2], 10)}일`;
  }

  function getCopywritingList() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_COPYWRITING);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter(item => item && item.date && item.content && item.content.trim());
        }
      }
    } catch (e) {}

    // 초기 기본 데이터 세팅
    const initial = writingSchedule
      .filter(function (item) {
        return item && item.date && item.content && item.content.trim();
      })
      .map(function (item) {
        return {
          date: item.date,
          content: item.content.trim(),
          updatedAt: Date.now()
        };
      });
    saveCopywritingList(initial);
    return initial;
  }

  function saveCopywritingList(list) {
    try {
      localStorage.setItem(STORAGE_KEY_COPYWRITING, JSON.stringify(list));
    } catch (e) {}
  }

  function updateDailyContent() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    const todayKey = getTodayKey();
    const dateFormatted = `${year}년 ${month}월 ${day}일`;

    lastLoadedDay = day;

    const scheduleList = getCopywritingList();
    const matchedItem = scheduleList.find(function (item) {
      return item.date === todayKey && item.content && item.content.trim();
    });

    if (matchedItem) {
      if (dateElement) dateElement.textContent = dateFormatted;
      if (contentElement) contentElement.textContent = matchedItem.content.trim();
      return;
    }

    // 오늘 날짜 글귀가 없으면 오늘 이전 날짜 중 가장 최근 글귀(없으면 전체 중 가장 최근 글귀) 표시
    const validItems = scheduleList
      .filter(function (item) {
        return item && item.date && item.content && item.content.trim();
      })
      .sort(function (a, b) {
        return a.date.localeCompare(b.date);
      });

    if (dateElement) {
      dateElement.textContent = dateFormatted;
    }

    if (contentElement) {
      if (validItems.length > 0) {
        const pastOrToday = validItems.filter(function (item) {
          return item.date <= todayKey;
        });
        const chosen = pastOrToday.length > 0
          ? pastOrToday[pastOrToday.length - 1]
          : validItems[validItems.length - 1];
        contentElement.textContent = chosen.content.trim();
      } else {
        contentElement.textContent = '등록된 베껴쓰기 글귀가 없습니다.';
      }
    }
  }

  function renderAdminCopywritingTable() {
    if (!copywritingTableBody) return;

    const list = getCopywritingList().slice().sort(function (a, b) {
      return (b.date || '').localeCompare(a.date || '');
    });

    if (copywritingListCount) {
      copywritingListCount.textContent = `총 ${list.length}건`;
    }

    if (list.length === 0) {
      copywritingTableBody.innerHTML = '<tr><td colspan="3" class="admin-posts-empty-row">등록된 베껴쓰기 글귀가 없습니다. 위 입력란에서 날짜와 내용을 등록해 보세요.</td></tr>';
      return;
    }

    const todayKey = getTodayKey();
    let html = '';

    list.forEach(function (item) {
      const dateStr = escapeHtml(item.date || '');
      const isToday = item.date === todayKey;
      const todayBadge = isToday ? '<span class="cw-today-badge">오늘</span>' : '';
      const rawContent = item.content || '';
      const oneLineContent = escapeHtml(rawContent.replace(/\s+/g, ' ').trim());
      const cleanTooltip = rawContent.replace(/"/g, '&quot;');

      html += `
        <tr>
          <td class="cell-cw-date">${dateStr}${todayBadge}</td>
          <td class="cell-cw-content" title="${cleanTooltip}">${oneLineContent}</td>
          <td class="cell-actions">
            <div class="table-actions-wrap">
              <button type="button" class="btn-table-edit btn-cw-edit" data-date="${dateStr}">✏️ 수정</button>
              <button type="button" class="btn-table-del btn-cw-del" data-date="${dateStr}">🗑️ 삭제</button>
            </div>
          </td>
        </tr>
      `;
    });

    copywritingTableBody.innerHTML = html;

    // 수정 버튼 클릭 시 입력란에 해당 날짜와 내용을 채움
    copywritingTableBody.querySelectorAll('.btn-cw-edit').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const targetDate = btn.getAttribute('data-date');
        const found = getCopywritingList().find(function (item) {
          return item.date === targetDate;
        });
        if (!found) return;

        if (copywritingInputDate) copywritingInputDate.value = found.date;
        if (copywritingInputContent) {
          copywritingInputContent.value = found.content;
          copywritingInputContent.focus();
        }
        if (btnSaveCopywriting) btnSaveCopywriting.textContent = '📖 수정 내용 저장';
        if (btnCancelCopywriting) btnCancelCopywriting.style.display = 'inline-flex';
      });
    });

    // 삭제 버튼 클릭 시 해당 날짜의 베껴쓰기 삭제
    copywritingTableBody.querySelectorAll('.btn-cw-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const targetDate = btn.getAttribute('data-date');
        if (!targetDate) return;

        if (!confirm(`[베껴쓰기 삭제]\n\n날짜: ${targetDate}\n이 날짜의 베껴쓰기 내용을 삭제하시겠습니까?`)) {
          return;
        }

        const updated = getCopywritingList().filter(function (item) {
          return item.date !== targetDate;
        });
        saveCopywritingList(updated);
        cloudDeleteCopywriting(targetDate);
        updateDailyContent();
        renderAdminCopywritingTable();
      });
    });
  }

  function resetCopywritingForm() {
    if (copywritingInputDate) copywritingInputDate.value = getTodayKey();
    if (copywritingInputContent) copywritingInputContent.value = '';
    if (btnSaveCopywriting) btnSaveCopywriting.textContent = '📖 베껴쓰기 등록 / 저장';
    if (btnCancelCopywriting) btnCancelCopywriting.style.display = 'none';
  }

  function initCopywritingAdmin() {
    if (copywritingInputDate && !copywritingInputDate.value) {
      copywritingInputDate.value = getTodayKey();
    }

    if (btnCancelCopywriting) {
      btnCancelCopywriting.addEventListener('click', function () {
        resetCopywritingForm();
      });
    }

    if (copywritingAdminForm) {
      copywritingAdminForm.addEventListener('submit', function (e) {
        e.preventDefault();

        if (!isAdmin(currentUser)) {
          alert('관리자만 베껴쓰기를 등록하거나 수정할 수 있습니다.');
          return;
        }

        const dateVal = copywritingInputDate ? copywritingInputDate.value.trim() : '';
        const contentVal = copywritingInputContent ? copywritingInputContent.value.trim() : '';

        if (!dateVal) {
          alert('날짜를 선택해 주세요.');
          if (copywritingInputDate) copywritingInputDate.focus();
          return;
        }

        if (!contentVal) {
          alert('베껴쓰기 내용을 입력해 주세요.');
          if (copywritingInputContent) copywritingInputContent.focus();
          return;
        }

        const list = getCopywritingList();
        const existingIndex = list.findIndex(function (item) {
          return item.date === dateVal;
        });

        const newItem = {
          date: dateVal,
          content: contentVal,
          updatedAt: Date.now()
        };

        if (existingIndex !== -1) {
          list[existingIndex] = newItem;
        } else {
          list.push(newItem);
        }

        list.sort(function (a, b) {
          return (a.date || '').localeCompare(b.date || '');
        });

        saveCopywritingList(list);
        cloudPushCopywriting(newItem);
        updateDailyContent();
        renderAdminCopywritingTable();
        resetCopywritingForm();

        alert(`${formatDateKorean(dateVal)} 베껴쓰기 내용이 저장되었습니다.`);
      });
    }

    renderAdminCopywritingTable();
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
   * 관리자 회원 글 모음 테이블 렌더링 (수정 및 삭제 기능 포함)
   */
  function renderAdminPostsTable() {
    if (!adminPostsTableBody) return;

    const allPosts = getAllPosts();
    if (allPosts.length === 0) {
      adminPostsTableBody.innerHTML = '<tr><td colspan="6" class="admin-posts-empty-row">작성된 회원 글이 없습니다.</td></tr>';
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
      const postId = escapeHtml(post.id);

      html += `
        <tr>
          <td class="cell-num">${num}</td>
          <td class="cell-date">${date}</td>
          <td class="cell-author">${author}</td>
          <td class="cell-title" title="${title}">${title}</td>
          <td class="cell-content" title="${cleanContentTooltip}">${content}</td>
          <td class="cell-actions">
            <div class="table-actions-wrap">
              <button type="button" class="btn-table-edit btn-admin-post-edit" data-id="${postId}">✏️ 수정</button>
              <button type="button" class="btn-table-del btn-admin-post-del" data-id="${postId}">🗑️ 삭제</button>
            </div>
          </td>
        </tr>
      `;
    });

    adminPostsTableBody.innerHTML = html;

    // 관리자 회원 글 수정 버튼 이벤트
    adminPostsTableBody.querySelectorAll('.btn-admin-post-edit').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-id');
        openAdminPostEditModal(id);
      });
    });

    // 관리자 회원 글 삭제 버튼 이벤트
    adminPostsTableBody.querySelectorAll('.btn-admin-post-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-id');
        deleteAdminPost(id);
      });
    });
  }

  /**
   * 관리자 회원 글 수정 모달 열기
   */
  function openAdminPostEditModal(postId) {
    if (!adminPostEditModal) return;
    const allPosts = getAllPosts();
    const post = allPosts.find(function (p) { return p.id === postId; });
    if (!post) {
      alert('해당 글을 찾을 수 없습니다.');
      return;
    }

    editingAdminPostId = post.id;
    if (adminPostMetaAuthor) adminPostMetaAuthor.textContent = `작성자: ${post.author || '익명'}`;
    if (adminPostMetaDate) adminPostMetaDate.textContent = `작성일시: ${post.createdAt || '-'}`;
    if (adminEditPostTitle) adminEditPostTitle.value = post.title || '';
    if (adminEditPostContent) adminEditPostContent.value = post.content || '';

    adminPostEditModal.style.display = 'flex';
    if (adminEditPostTitle) adminEditPostTitle.focus();
  }

  /**
   * 관리자 회원 글 수정 모달 닫기
   */
  function closeAdminPostEditModal() {
    editingAdminPostId = null;
    if (adminPostEditModal) adminPostEditModal.style.display = 'none';
    if (adminEditPostTitle) adminEditPostTitle.value = '';
    if (adminEditPostContent) adminEditPostContent.value = '';
  }

  /**
   * 관리자 회원 글 삭제 처리
   */
  function deleteAdminPost(postId) {
    const allPosts = getAllPosts();
    const post = allPosts.find(function (p) { return p.id === postId; });
    if (!post) return;

    const authorName = post.author || '익명';
    const postTitle = post.title || '제목 없음';

    if (!confirm(`[관리자 확인]\n\n작성자: ${authorName}\n제목: "${postTitle}"\n\n이 회원 글을 정말 삭제하시겠습니까?\n(삭제 시 파이어베이스 실시간 데이터베이스에서도 완전히 삭제됩니다)`)) {
      return;
    }

    const updated = allPosts.filter(function (p) { return p.id !== postId; });
    saveAllPosts(updated);
    cloudDeletePost(postId);

    if (selectedPostId === postId) {
      selectedPostId = null;
      if (postViewCard) postViewCard.style.display = 'none';
    }

    renderAdminPostsTable();
    renderUserPosts();
    alert(`"${postTitle}" 회원 글이 삭제되었습니다.`);
  }

  /**
   * 관리자 회원 글 수정 모달 이벤트 초기화
   */
  function initAdminPostEditModal() {
    if (btnSaveAdminPost) {
      btnSaveAdminPost.addEventListener('click', function () {
        if (!editingAdminPostId) return;

        const newTitle = adminEditPostTitle ? adminEditPostTitle.value.trim() : '';
        const newContent = adminEditPostContent ? adminEditPostContent.value.trim() : '';

        if (!newTitle) {
          alert('글 제목을 입력해 주세요.');
          if (adminEditPostTitle) adminEditPostTitle.focus();
          return;
        }

        if (!newContent) {
          alert('글 내용을 입력해 주세요.');
          if (adminEditPostContent) adminEditPostContent.focus();
          return;
        }

        const allPosts = getAllPosts();
        const postIndex = allPosts.findIndex(function (p) { return p.id === editingAdminPostId; });
        if (postIndex === -1) {
          alert('수정할 글을 찾을 수 없습니다.');
          closeAdminPostEditModal();
          return;
        }

        allPosts[postIndex].title = newTitle;
        allPosts[postIndex].content = newContent;
        saveAllPosts(allPosts);
        cloudPushPost(allPosts[postIndex]);

        renderAdminPostsTable();
        renderUserPosts();
        if (selectedPostId === editingAdminPostId) {
          renderPostDetail(selectedPostId);
        }

        const savedTitle = newTitle;
        closeAdminPostEditModal();
        alert(`[관리자] "${savedTitle}" 글이 성공적으로 수정 및 저장되었습니다.`);
      });
    }

    if (btnCancelAdminPost) btnCancelAdminPost.addEventListener('click', closeAdminPostEditModal);
    if (adminPostEditClose) adminPostEditClose.addEventListener('click', closeAdminPostEditModal);
    if (adminPostEditBackdrop) adminPostEditBackdrop.addEventListener('click', closeAdminPostEditModal);
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
      if (saved && saved.includes('senior-kitchen-default-rtdb')) {
        localStorage.setItem(STORAGE_KEY_CLOUD_URL, DEFAULT_CLOUD_URL);
        return DEFAULT_CLOUD_URL;
      }
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
      } else if (state === 'error' || state === 'locked') {
        syncIndicatorDot.className = 'sync-indicator-dot';
        syncIndicatorDot.style.backgroundColor = '#E74C3C';
      } else if (state === 'warning') {
        syncIndicatorDot.className = 'sync-indicator-dot';
        syncIndicatorDot.style.backgroundColor = '#E67E22';
      } else if (state === 'idle') {
        syncIndicatorDot.className = 'sync-indicator-dot';
        syncIndicatorDot.style.backgroundColor = '#95A5A6';
      } else {
        syncIndicatorDot.className = 'sync-indicator-dot';
        syncIndicatorDot.style.backgroundColor = '#27AE60';
      }
    }
  }

  /**
   * 구글 파이어베이스 실시간 데이터베이스(RTDB) 연결 및 보안 규칙 진단
   */
  async function testFirebaseConnection(silent) {
    const url = getCloudUrl();
    if (!url) {
      if (firebaseDiagnosisBox) {
        firebaseDiagnosisBox.className = 'firebase-diagnosis-box locked';
        firebaseDiagnosisBox.textContent = '❌ 클라우드 데이터베이스 URL이 설정되어 있지 않습니다.';
      }
      setSyncStatus('error', '클라우드 DB URL 미설정');
      return { ok: false, reason: 'no_url' };
    }

    if (firebaseDiagnosisBox) {
      firebaseDiagnosisBox.className = 'firebase-diagnosis-box checking';
      firebaseDiagnosisBox.textContent = '🔍 구글 파이어베이스 서버 연결 및 보안 규칙 상태 확인 중...';
    }
    setSyncStatus('syncing', '파이어베이스 연결 진단 중...');

    try {
      // 1. 읽기 테스트
      const readRes = await fetch(`${url}/attendance.json?shallow=true`, { method: 'GET' }).catch(err => {
        throw new Error('네트워크 연결 불가: ' + (err.message || '인터넷 연결을 확인해 주세요.'));
      });

      if (readRes.status === 401 || readRes.status === 403) {
        if (firebaseDiagnosisBox) {
          firebaseDiagnosisBox.className = 'firebase-diagnosis-box locked';
          firebaseDiagnosisBox.innerHTML = '⚠️ <strong>보안 규칙 잠김 (401 Permission Denied)</strong>: 파이어베이스 서버는 정상 응답했으나, 데이터베이스 [보안 규칙]이 잠겨 있어 읽기/쓰기가 차단되었습니다.<br>아래 <strong>[규칙 가이드]</strong> 1~3단계를 따라 Firebase 콘솔에서 규칙을 <code>true</code>로 변경한 후 <strong>[게시]</strong>를 눌러주세요.';
        }
        setSyncStatus('error', '⚠️ 파이어베이스 규칙 잠김 (401 Permission Denied) - 가이드 참조');
        if (!silent) {
          if (syncSettingsPanel) syncSettingsPanel.style.display = 'block';
          alert('⚠️ [파이어베이스 보안 규칙 잠김 (401 Permission Denied)]\n\n파이어베이스 서버와 정상 연결되었으나, 데이터베이스 [보안 규칙]이 잠겨 있어 데이터를 읽거나 쓸 수 없습니다.\n\n화면에 표시된 [규칙 설정 가이드] 1~3단계를 따라 콘솔에서 .read와 .write를 true로 설정하고 [게시]를 눌러주세요.');
        }
        return { ok: false, reason: 'permission_denied' };
      }

      if (!readRes.ok) {
        const msg = `⚠️ 파이어베이스 서버 응답 오류 (HTTP ${readRes.status})`;
        if (firebaseDiagnosisBox) {
          firebaseDiagnosisBox.className = 'firebase-diagnosis-box locked';
          firebaseDiagnosisBox.textContent = msg;
        }
        setSyncStatus('error', msg);
        if (!silent) alert(msg);
        return { ok: false, reason: 'http_error', status: readRes.status };
      }

      // 2. 쓰기 테스트
      const pingKey = `ping_${Date.now()}`;
      const pingRes = await fetch(`${url}/connection_check/${pingKey}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ok', time: new Date().toISOString() })
      }).catch(() => null);

      if (pingRes && (pingRes.status === 401 || pingRes.status === 403)) {
        if (firebaseDiagnosisBox) {
          firebaseDiagnosisBox.className = 'firebase-diagnosis-box locked';
          firebaseDiagnosisBox.innerHTML = '⚠️ <strong>쓰기 규칙 잠김</strong>: 읽기는 가능하나 데이터 쓰기 권한이 없습니다. Firebase 콘솔에서 <code>.write: true</code> 규칙을 적용해 주세요.';
        }
        setSyncStatus('error', '⚠️ 파이어베이스 쓰기 규칙 잠김');
        if (!silent) alert('⚠️ 파이어베이스 쓰기 규칙이 잠겨 있습니다. .write를 true로 설정해 주세요.');
        return { ok: false, reason: 'write_locked' };
      }

      if (pingRes && pingRes.ok) {
        fetch(`${url}/connection_check/${pingKey}.json`, { method: 'DELETE' }).catch(() => {});
      }

      // 성공!
      if (firebaseDiagnosisBox) {
        firebaseDiagnosisBox.className = 'firebase-diagnosis-box success';
        firebaseDiagnosisBox.innerHTML = '✅ <strong>파이어베이스 실시간 연동 성공!</strong> 구글 데이터베이스와 정상적으로 양방향 통신 중입니다. PC와 모바일의 모든 데이터(출석, 글, 사진, 질문)가 실시간으로 안전하게 공유됩니다.';
      }
      setSyncStatus('success', '🟢 파이어베이스 실시간 연동 정상 (PC·모바일 동기화 중)');
      if (!silent) {
        alert('🎉 구글 파이어베이스 실시간 데이터베이스(RTDB)와 100% 정상 연동되었습니다!\n\n이제 PC와 스마트폰 등 모든 기기에서 사진, 출석, 글, Q&A가 실시간으로 공유됩니다.');
      }
      return { ok: true };
    } catch (err) {
      const errMsg = `❌ 파이어베이스 서버 연결 실패: ${err.message || '인터넷 연결을 확인해 주세요.'}`;
      if (firebaseDiagnosisBox) {
        firebaseDiagnosisBox.className = 'firebase-diagnosis-box locked';
        firebaseDiagnosisBox.textContent = errMsg;
      }
      setSyncStatus('error', '파이어베이스 서버 연결 실패');
      if (!silent) alert(errMsg);
      return { ok: false, reason: 'network_error', error: err };
    }
  }

  /**
   * 브라우저(localStorage)에 보관된 모든 데이터를 파이어베이스 클라우드로 일괄 전송
   */
  async function uploadAllLocalDataToFirebase() {
    const url = getCloudUrl();
    if (!url) {
      alert('클라우드 DB URL이 설정되지 않았습니다.');
      return;
    }

    if (!confirm('현재 브라우저에 저장된 모든 데이터(출석체크, 회원 글, 사진첩, Q&A)를 파이어베이스 클라우드로 일괄 전송하시겠습니까?\n\n파이어베이스 콘솔에서 즉시 모든 데이터 트리가 생성됩니다.')) {
      return;
    }

    setSyncStatus('syncing', '브라우저 데이터 파이어베이스로 전체 업로드 중...');

    try {
      const attRecords = getAttendanceRecords();
      const allPosts = getAllPosts();
      const photos = getPhotos();
      const qnaList = getQnaList();
      const copywritingList = getCopywritingList();

      const postsObj = {};
      allPosts.forEach(p => { if (p && p.id) postsObj[p.id] = p; });

      const photosObj = {};
      photos.forEach(p => { if (p && p.id) photosObj[p.id] = p; });

      const qnaObj = {};
      qnaList.forEach(q => { if (q && q.id) qnaObj[q.id] = q; });

      const cwObj = {};
      copywritingList.forEach(c => { if (c && c.date) cwObj[c.date] = c; });

      const [attRes, postRes, photoRes, qnaRes, cwRes] = await Promise.all([
        fetch(`${url}/attendance.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(attRecords)
        }).catch(err => ({ ok: false, status: 0, err })),
        fetch(`${url}/posts.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(postsObj)
        }).catch(err => ({ ok: false, status: 0, err })),
        fetch(`${url}/photos.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(photosObj)
        }).catch(err => ({ ok: false, status: 0, err })),
        fetch(`${url}/qna.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(qnaObj)
        }).catch(err => ({ ok: false, status: 0, err })),
        fetch(`${url}/copywriting.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cwObj)
        }).catch(err => ({ ok: false, status: 0, err }))
      ]);

      const any401 = [attRes, postRes, photoRes, qnaRes, cwRes].some(r => r && (r.status === 401 || r.status === 403));
      if (any401) {
        setSyncStatus('error', '⚠️ 파이어베이스 규칙 잠김 (401 Permission Denied)');
        if (firebaseDiagnosisBox) {
          firebaseDiagnosisBox.className = 'firebase-diagnosis-box locked';
          firebaseDiagnosisBox.innerHTML = '⚠️ <strong>보안 규칙 잠김 (401 Permission Denied)</strong>: 파이어베이스 실시간 데이터베이스 보안 규칙이 잠겨 있어 전송할 수 없습니다. 콘솔에서 <code>.read: true, .write: true</code> 로 변경해 주세요.';
        }
        if (syncSettingsPanel) syncSettingsPanel.style.display = 'block';
        alert('⚠️ [전송 실패: 파이어베이스 규칙 잠김]\n\n파이어베이스 실시간 데이터베이스 보안 규칙이 잠겨 있어 전송이 거부되었습니다. (401 Permission Denied)\n\n화면의 [규칙 가이드]를 참고하여 Firebase 콘솔 [규칙] 탭에서 .read와 .write를 true로 설정하고 [게시]를 눌러주세요.');
        return;
      }

      setSyncStatus('success', '🟢 브라우저 데이터 파이어베이스 업로드 완료');
      if (firebaseDiagnosisBox) {
        firebaseDiagnosisBox.className = 'firebase-diagnosis-box success';
        firebaseDiagnosisBox.innerHTML = '✅ <strong>전체 데이터 업로드 완료!</strong> 출석체크, 회원 글, 사진첩, Q&A가 파이어베이스에 성공적으로 저장되었습니다.';
      }
      alert(`🎉 파이어베이스 업로드 성공!\n\n- 출석 기록: ${attRecords.length}건\n- 회원 글: ${allPosts.length}편\n- 사진첩: ${photos.length}장\n- 질문과 답: ${qnaList.length}건\n\n파이어베이스 콘솔 화면을 새로고침하시면 위 데이터가 실시간으로 반영된 것을 확인하실 수 있습니다.`);
    } catch (err) {
      alert('업로드 중 오류가 발생했습니다: ' + err.message);
      setSyncStatus('error', '업로드 오류');
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
      }).then(res => {
        if (res.status === 401 || res.status === 403) {
          console.warn('파이어베이스 규칙 잠김: 출석 전송 거부됨(401)');
          setSyncStatus('error', '⚠️ 파이어베이스 규칙 잠김 (401 Permission Denied)');
        }
      }).catch(function (err) {
        console.warn('출석 클라우드 전송 실패:', err);
      });
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
      }).then(res => {
        if (res.status === 401 || res.status === 403) {
          setSyncStatus('error', '⚠️ 파이어베이스 규칙 잠김 (401 Permission Denied)');
        }
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
      }).then(res => {
        if (res.status === 401 || res.status === 403) {
          console.warn('파이어베이스 규칙 잠김: 글 전송 거부됨(401)');
          setSyncStatus('error', '⚠️ 파이어베이스 규칙 잠김 (401 Permission Denied)');
        }
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
      }).then(res => {
        if (res.status === 401 || res.status === 403) {
          setSyncStatus('error', '⚠️ 파이어베이스 규칙 잠김 (401 Permission Denied)');
        }
      }).catch(function () {});
    } catch (e) {}
  }

  function cloudPushPhoto(photo) {
    const url = getCloudUrl();
    if (!url || !photo || !photo.id) return;
    try {
      fetch(`${url}/photos/${photo.id}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(photo)
      }).then(res => {
        if (res.status === 401 || res.status === 403) {
          console.warn('파이어베이스 규칙 잠김: 사진 전송 거부됨(401)');
          setSyncStatus('error', '⚠️ 파이어베이스 규칙 잠김 (401 Permission Denied)');
        }
      }).catch(function (err) {
        console.warn('사진 클라우드 전송 실패:', err);
      });
    } catch (e) {}
  }

  function cloudDeletePhoto(photoId) {
    const url = getCloudUrl();
    if (!url || !photoId) return;
    try {
      fetch(`${url}/photos/${photoId}.json`, {
        method: 'DELETE'
      }).catch(function () {});
    } catch (e) {}
  }

  function cloudSyncAllPhotos(photos) {
    const url = getCloudUrl();
    if (!url) return;
    try {
      const photosObj = {};
      photos.forEach(p => { photosObj[p.id] = p; });
      fetch(`${url}/photos.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(photosObj)
      }).then(res => {
        if (res.status === 401 || res.status === 403) {
          setSyncStatus('error', '⚠️ 파이어베이스 규칙 잠김 (401 Permission Denied)');
        }
      }).catch(function () {});
    } catch (e) {}
  }

  function cloudPushQna(qnaItem) {
    const url = getCloudUrl();
    if (!url || !qnaItem || !qnaItem.id) return;
    try {
      fetch(`${url}/qna/${qnaItem.id}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(qnaItem)
      }).then(res => {
        if (res.status === 401 || res.status === 403) {
          console.warn('파이어베이스 규칙 잠김: Q&A 전송 거부됨(401)');
          setSyncStatus('error', '⚠️ 파이어베이스 규칙 잠김 (401 Permission Denied)');
        }
      }).catch(function (err) {
        console.warn('Q&A 클라우드 전송 실패:', err);
      });
    } catch (e) {}
  }

  function cloudDeleteQna(qnaId) {
    const url = getCloudUrl();
    if (!url || !qnaId) return;
    try {
      fetch(`${url}/qna/${qnaId}.json`, {
        method: 'DELETE'
      }).catch(function () {});
    } catch (e) {}
  }

  function cloudSyncAllQna(qnaList) {
    const url = getCloudUrl();
    if (!url) return;
    try {
      const qnaObj = {};
      qnaList.forEach(q => { qnaObj[q.id] = q; });
      fetch(`${url}/qna.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(qnaObj)
      }).then(res => {
        if (res.status === 401 || res.status === 403) {
          setSyncStatus('error', '⚠️ 파이어베이스 규칙 잠김 (401 Permission Denied)');
        }
      }).catch(function () {});
    } catch (e) {}
  }

  function cloudPushCopywriting(cwItem) {
    const url = getCloudUrl();
    if (!url || !cwItem || !cwItem.date) return;
    try {
      fetch(`${url}/copywriting/${encodeURIComponent(cwItem.date)}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cwItem)
      }).catch(function () {});
    } catch (e) {}
  }

  function cloudDeleteCopywriting(dateKey) {
    const url = getCloudUrl();
    if (!url || !dateKey) return;
    try {
      fetch(`${url}/copywriting/${encodeURIComponent(dateKey)}.json`, {
        method: 'DELETE'
      }).catch(function () {});
    } catch (e) {}
  }

  function cloudSyncAllCopywriting(cwList) {
    const url = getCloudUrl();
    if (!url) return;
    try {
      const cwObj = {};
      cwList.forEach(c => { if (c && c.date) cwObj[c.date] = c; });
      fetch(`${url}/copywriting.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cwObj)
      }).catch(function () {});
    } catch (e) {}
  }

  /**
   * 다른 기기(PC, 모바일폰)에서 등록된 출석, 글, 사진, Q&A를 클라우드에서 가져와 병합
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

      const [attRes, postRes, photoRes, qnaRes, cwRes] = await Promise.all([
        fetch(`${url}/attendance.json`, { signal: controller.signal }).catch(() => null),
        fetch(`${url}/posts.json`, { signal: controller.signal }).catch(() => null),
        fetch(`${url}/photos.json`, { signal: controller.signal }).catch(() => null),
        fetch(`${url}/qna.json`, { signal: controller.signal }).catch(() => null),
        fetch(`${url}/copywriting.json`, { signal: controller.signal }).catch(() => null)
      ]);
      clearTimeout(timeoutId);

      // 401/403 권한 거부(보안 규칙 잠김) 감지
      const responses = [attRes, postRes, photoRes, qnaRes, cwRes];
      const isPermissionDenied = responses.some(r => r && (r.status === 401 || r.status === 403));

      if (isPermissionDenied) {
        setSyncStatus('error', '⚠️ 파이어베이스 규칙 잠김 (401 Permission Denied) - 설정 가이드 참조');
        if (firebaseDiagnosisBox) {
          firebaseDiagnosisBox.className = 'firebase-diagnosis-box locked';
          firebaseDiagnosisBox.innerHTML = '⚠️ <strong>보안 규칙 잠김 (401 Permission Denied)</strong>: 파이어베이스 서버는 정상 응답하였으나 데이터베이스 [보안 규칙]이 잠겨 있습니다.<br>아래 <strong>[규칙 가이드]</strong>에 따라 Firebase 콘솔 [규칙] 탭에서 <code>.read: true, .write: true</code> 로 설정하고 [게시]를 눌러주세요.';
        }
        if (isManual) {
          if (syncSettingsPanel) syncSettingsPanel.style.display = 'block';
          alert('⚠️ [파이어베이스 보안 규칙 잠김 (401 Permission Denied)]\n\n파이어베이스 실시간 데이터베이스의 보안 규칙이 잠겨 있어 다른 기기의 데이터를 가져오거나 저장할 수 없습니다.\n\n[파이어베이스 설정 / 연동 가이드]의 안내에 따라 Firebase 콘솔 [규칙(Rules)] 페이지에서 읽기/쓰기를 true로 변경하고 [게시]를 눌러주세요.');
        }
        return;
      }

      let attUpdated = false;
      let postUpdated = false;
      let photoUpdated = false;
      let qnaUpdated = false;

      // 1. 출석체크 병합
      if (attRes && attRes.ok) {
        const attData = await attRes.json();
        if (attData && !attData.error) {
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
        if (postData && !postData.error) {
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

      // 3. 사진첩 병합
      if (photoRes && photoRes.ok) {
        const photoData = await photoRes.json();
        if (photoData && !photoData.error) {
          const cloudPhotos = Array.isArray(photoData) ? photoData.filter(Boolean) : Object.values(photoData);
          const localPhotos = getPhotos();
          const photoMap = new Map();

          localPhotos.forEach(p => { if (p && p.id) photoMap.set(p.id, p); });

          cloudPhotos.forEach(p => {
            if (p && p.id && p.imageData) {
              if (p.author && String(p.author).trim().includes(ADMIN_NAME)) {
                p.author = ADMIN_DISPLAY_NAME;
                photoUpdated = true;
                cloudPushPhoto(p);
              }
              if (!photoMap.has(p.id)) {
                photoMap.set(p.id, p);
                photoUpdated = true;
              } else {
                const existing = photoMap.get(p.id);
                if (existing.author && String(existing.author).trim().includes(ADMIN_NAME)) {
                  existing.author = ADMIN_DISPLAY_NAME;
                  photoMap.set(p.id, existing);
                  photoUpdated = true;
                  cloudPushPhoto(existing);
                }
              }
            }
          });

          if (photoUpdated) {
            const mergedPhotos = Array.from(photoMap.values());
            mergedPhotos.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            savePhotos(mergedPhotos);
            renderPhotoGallery();
          }
        }
      }

      // 4. 질문과 답 (Q&A) 병합
      if (qnaRes && qnaRes.ok) {
        const qnaData = await qnaRes.json();
        if (qnaData && !qnaData.error) {
          const cloudQna = Array.isArray(qnaData) ? qnaData.filter(Boolean) : Object.values(qnaData);
          const localQna = getQnaList();
          const qnaMap = new Map();

          localQna.forEach(q => { if (q && q.id) qnaMap.set(q.id, q); });

          cloudQna.forEach(q => {
            if (q && q.id && q.title) {
              let cloudQnaNeedsFix = false;
              if (q.answeredBy && String(q.answeredBy).trim().includes(ADMIN_NAME)) {
                q.answeredBy = ADMIN_DISPLAY_NAME;
                qnaUpdated = true;
                cloudQnaNeedsFix = true;
              }
              if (q.author && String(q.author).trim().includes(ADMIN_NAME)) {
                q.author = ADMIN_DISPLAY_NAME;
                qnaUpdated = true;
                cloudQnaNeedsFix = true;
              }
              if (cloudQnaNeedsFix) {
                cloudPushQna(q);
              }
              if (!qnaMap.has(q.id)) {
                qnaMap.set(q.id, q);
                qnaUpdated = true;
              } else {
                const existing = qnaMap.get(q.id);
                if (existing.answeredBy && String(existing.answeredBy).trim().includes(ADMIN_NAME)) {
                  existing.answeredBy = ADMIN_DISPLAY_NAME;
                  qnaMap.set(q.id, existing);
                  qnaUpdated = true;
                }
                // 클라우드에 답변이 새로 등록/수정되었으면 병합
                if (q.answer && (!existing.answer || q.answeredAt > existing.answeredAt)) {
                  qnaMap.set(q.id, q);
                  qnaUpdated = true;
                }
              }
            }
          });

          if (qnaUpdated) {
            const mergedQna = Array.from(qnaMap.values());
            mergedQna.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            saveQnaList(mergedQna);
            renderQnaList();
          }
        }
      }

      // 5. 베껴쓰기 병합
      if (cwRes && cwRes.ok) {
        const cwData = await cwRes.json();
        if (cwData && !cwData.error) {
          const cloudCw = Array.isArray(cwData) ? cwData.filter(Boolean) : Object.values(cwData);
          const localCw = getCopywritingList();
          const cwMap = new Map();
          let cwUpdated = false;

          localCw.forEach(c => { if (c && c.date && c.content) cwMap.set(c.date, c); });

          cloudCw.forEach(c => {
            if (c && c.date && c.content) {
              if (!cwMap.has(c.date)) {
                cwMap.set(c.date, c);
                cwUpdated = true;
              } else {
                const existing = cwMap.get(c.date);
                if ((c.updatedAt || 0) > (existing.updatedAt || 0)) {
                  cwMap.set(c.date, c);
                  cwUpdated = true;
                }
              }
            }
          });

          if (cwUpdated) {
            const mergedCw = Array.from(cwMap.values()).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
            saveCopywritingList(mergedCw);
            updateDailyContent();
            if (isAdmin(currentUser)) {
              renderAdminCopywritingTable();
            }
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
        alert('다른 기기(PC, 모바일폰)의 최신 데이터(출석, 글, 사진, Q&A)와 성공적으로 동기화되었습니다.');
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
    testFirebaseConnection(true); // 관리자 화면 진입 시 파이어베이스 실시간 상태 점검
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

      // 2. 관리자(예성원/8797) 로그인 시에만 베껴쓰기 관리, 출석체크 및 회원 글 모음 노출
      if (isAdmin(user)) {
        if (adminCopywritingManager) adminCopywritingManager.style.display = 'block';
        if (adminAttendanceSection) adminAttendanceSection.style.display = 'block';
        if (adminNavItem) adminNavItem.style.display = 'inline-block';
        if (adminPostsSection) adminPostsSection.style.display = 'block';
        if (adminPostsNavItem) adminPostsNavItem.style.display = 'inline-block';
        renderAdminCopywritingTable();
        renderAdminAttendanceTable();
        renderAdminPostsTable();
        startAdminCloudSync();
      } else {
        if (adminCopywritingManager) adminCopywritingManager.style.display = 'none';
        if (adminAttendanceSection) adminAttendanceSection.style.display = 'none';
        if (adminNavItem) adminNavItem.style.display = 'none';
        if (adminPostsSection) adminPostsSection.style.display = 'none';
        if (adminPostsNavItem) adminPostsNavItem.style.display = 'none';
        stopAdminCloudSync();
      }

      // 사진 및 Q&A 작성자/비번 자동 입력 (관리자 로그인 시 '예성원' 대신 '관리자'로 설정)
      const displayAuthor = isAdmin(user) ? ADMIN_DISPLAY_NAME : user.name;
      if (photoAuthorInput && (!photoAuthorInput.value || photoAuthorInput.value.includes(ADMIN_NAME) || isAdmin(user))) {
        photoAuthorInput.value = displayAuthor;
      }
      if (photoPinInput && !photoPinInput.value) photoPinInput.value = user.pin;
      if (qnaNameInput && (!qnaNameInput.value || qnaNameInput.value.includes(ADMIN_NAME) || isAdmin(user))) {
        qnaNameInput.value = displayAuthor;
      }
      if (qnaPinInput && !qnaPinInput.value) qnaPinInput.value = user.pin;
      renderPhotoGallery();
      renderQnaList();
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

      if (adminCopywritingManager) adminCopywritingManager.style.display = 'none';
      if (adminAttendanceSection) adminAttendanceSection.style.display = 'none';
      if (adminNavItem) adminNavItem.style.display = 'none';
      if (adminPostsSection) adminPostsSection.style.display = 'none';
      if (adminPostsNavItem) adminPostsNavItem.style.display = 'none';
      stopAdminCloudSync();

      if (photoAuthorInput) photoAuthorInput.value = '';
      if (photoPinInput) photoPinInput.value = '';
      if (qnaNameInput) qnaNameInput.value = '';
      if (qnaPinInput) qnaPinInput.value = '';

      renderPhotoGallery();
      renderQnaList();
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

    if (btnTestFirebase) {
      btnTestFirebase.addEventListener('click', function () {
        testFirebaseConnection(false);
      });
    }

    if (btnTestFirebasePanel) {
      btnTestFirebasePanel.addEventListener('click', function () {
        testFirebaseConnection(false);
      });
    }

    if (btnUploadAllCloud) {
      btnUploadAllCloud.addEventListener('click', function () {
        uploadAllLocalDataToFirebase();
      });
    }

    if (btnCopyRulesCode) {
      btnCopyRulesCode.addEventListener('click', function () {
        const code = `{\n  "rules": {\n    ".read": true,\n    ".write": true\n  }\n}`;
        function showCopied() {
          btnCopyRulesCode.textContent = '✅ 복사 완료!';
          setTimeout(function () {
            btnCopyRulesCode.textContent = '📋 규칙 코드 복사';
          }, 2500);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).then(showCopied).catch(function () {
            copyFallback(code);
          });
        } else {
          copyFallback(code);
        }

        function copyFallback(text) {
          try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showCopied();
          } catch (e) {
            alert('아래 코드를 복사하여 Firebase 콘솔 규칙에 붙여넣으세요:\n\n' + text);
          }
        }
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
          posts: getAllPosts(),
          photos: getPhotos(),
          qnaList: getQnaList()
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

            let importedPhotoCount = 0;
            if (Array.isArray(data.photos)) {
              const localPhotos = getPhotos();
              const photoMap = new Map();
              localPhotos.forEach(function (p) { photoMap.set(p.id, p); });
              data.photos.forEach(function (p) {
                if (p && p.id && p.imageData) {
                  if (!photoMap.has(p.id)) {
                    photoMap.set(p.id, p);
                    importedPhotoCount++;
                  }
                }
              });
              const mergedPhotos = Array.from(photoMap.values());
              savePhotos(mergedPhotos);
              cloudSyncAllPhotos(mergedPhotos);
              renderPhotoGallery();
            }

            let importedQnaCount = 0;
            if (Array.isArray(data.qnaList)) {
              const localQna = getQnaList();
              const qnaMap = new Map();
              localQna.forEach(function (q) { qnaMap.set(q.id, q); });
              data.qnaList.forEach(function (q) {
                if (q && q.id && q.title) {
                  if (!qnaMap.has(q.id)) {
                    qnaMap.set(q.id, q);
                    importedQnaCount++;
                  }
                }
              });
              const mergedQna = Array.from(qnaMap.values());
              saveQnaList(mergedQna);
              cloudSyncAllQna(mergedQna);
              renderQnaList();
            }

            if (isAdmin(currentUser)) {
              renderAdminAttendanceTable();
              renderAdminPostsTable();
            }

            alert(`데이터 복원이 완료되었습니다.\n- 출석 기록: ${importedAttCount}건\n- 회원 글: ${importedPostCount}편\n- 나눔 사진: ${importedPhotoCount}장\n- 질문과 답변: ${importedQnaCount}건`);
          } catch (err) {
            alert('파일을 읽는 중 오류가 발생했습니다: ' + err.message);
          }
        };
        reader.readAsText(file, 'utf-8');
      });
    }
  }

  /* ========================================================
     4. 사진첩 & 초경량 Canvas 압축 시스템
     (파이어베이스 1GB 한도 내에서 수만 장 보관 가능하도록 99% 축소)
     ======================================================== */
  function formatDateTime(now) {
    const d = now instanceof Date ? now : new Date(now || Date.now());
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}.${month}.${day} ${hours}:${minutes}`;
  }

  function formatBytes(bytes) {
    const b = Number(bytes) || 0;
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / (1024 * 1024)).toFixed(2) + ' MB';
  }

  /**
   * 클라이언트 측 스마트 압축:
   * 1. 해상도를 가로세로 최대 640px로 부드럽게 다운샘플링
   * 2. WebP 포맷(미지원 시 JPEG) 0.52 품질로 압축
   * 결과: 5~10MB 스마트폰 원본 사진을 25~40KB 수준으로 99% 축소
   */
  function compressImage(file, maxDimension = 640, quality = 0.52) {
    return new Promise(function (resolve, reject) {
      if (!file || !file.type.startsWith('image/')) {
        return reject(new Error('선택한 파일이 이미지 형식이 아닙니다.'));
      }

      const reader = new FileReader();
      reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
          let width = img.width;
          let height = img.height;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          let dataUrl = canvas.toDataURL('image/webp', quality);
          if (!dataUrl || !dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          const base64Str = dataUrl.split(',')[1] || '';
          const compressedBytes = Math.round((base64Str.length * 3) / 4);
          const originalBytes = file.size;

          resolve({
            dataUrl: dataUrl,
            width: width,
            height: height,
            originalBytes: originalBytes,
            compressedBytes: compressedBytes
          });
        };
        img.onerror = function () {
          reject(new Error('이미지를 불러오지 못했습니다.'));
        };
        img.src = e.target.result;
      };
      reader.onerror = function () {
        reject(new Error('파일을 읽지 못했습니다.'));
      };
      reader.readAsDataURL(file);
    });
  }

  function getPhotos() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PHOTOS);
      const list = raw ? JSON.parse(raw) : [];
      let changed = false;
      list.forEach(function (p) {
        if (p && p.author && String(p.author).trim().includes(ADMIN_NAME)) {
          p.author = ADMIN_DISPLAY_NAME;
          changed = true;
          cloudPushPhoto(p);
        }
      });
      if (changed) {
        savePhotos(list);
      }
      return list;
    } catch (e) {
      return [];
    }
  }

  function savePhotos(photos) {
    try {
      localStorage.setItem(STORAGE_KEY_PHOTOS, JSON.stringify(photos));
    } catch (e) {}
  }

  function initPhotos() {
    // 사진 게시자 입력란에 '예성원' 입력 시 자동으로 '관리자'로 변환
    if (photoAuthorInput) {
      const normalizePhotoAuthor = function () {
        if (photoAuthorInput.value.trim() === ADMIN_NAME) {
          photoAuthorInput.value = ADMIN_DISPLAY_NAME;
        }
      };
      photoAuthorInput.addEventListener('input', normalizePhotoAuthor);
      photoAuthorInput.addEventListener('change', normalizePhotoAuthor);
      photoAuthorInput.addEventListener('blur', normalizePhotoAuthor);
    }

    // 1. 사진 파일 선택 시 즉시 초경량 압축 및 미리보기 생성
    if (photoFileInput) {
      photoFileInput.addEventListener('change', async function (e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (photoFileLabelText) {
          photoFileLabelText.textContent = `압축 최적화 중... (${file.name})`;
        }

        try {
          const result = await compressImage(file, 640, 0.52);
          currentCompressedPhoto = result;

          if (photoPreviewImg) {
            photoPreviewImg.src = result.dataUrl;
          }

          const savedPercent = Math.max(0, ((1 - result.compressedBytes / result.originalBytes) * 100)).toFixed(1);
          if (statSizeHighlight) {
            statSizeHighlight.textContent = `⚡ 99% 용량 최적화 성공 (${savedPercent}% 절약)`;
          }
          if (statSizeDetail) {
            statSizeDetail.textContent = `원본 ${formatBytes(result.originalBytes)} → 압축 후 ${formatBytes(result.compressedBytes)} (파이어베이스 1GB 보관 최적화)`;
          }

          if (photoFileLabelText) {
            photoFileLabelText.textContent = `사진 변경하기: ${file.name}`;
          }

          // 로그인 사용자가 있다면 이름/비번 자동 입력 (관리자 로그인 시 '예성원' 대신 '관리자'로 설정)
          if (currentUser) {
            const defaultPhotoAuthor = isAdmin(currentUser) ? ADMIN_DISPLAY_NAME : currentUser.name;
            if (photoAuthorInput && (!photoAuthorInput.value || photoAuthorInput.value === ADMIN_NAME || isAdmin(currentUser))) {
              photoAuthorInput.value = defaultPhotoAuthor;
            }
            if (photoPinInput && !photoPinInput.value) photoPinInput.value = currentUser.pin;
          }

          if (photoPreviewBox) {
            photoPreviewBox.style.display = 'block';
            photoPreviewBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        } catch (err) {
          alert('사진을 처리하는 중 오류가 발생했습니다: ' + err.message);
          if (photoFileLabelText) {
            photoFileLabelText.textContent = '스마트폰 또는 컴퓨터에서 사진 선택하기';
          }
        }
      });
    }

    // 2. 취소 버튼
    if (btnCancelPhoto) {
      btnCancelPhoto.addEventListener('click', function () {
        currentCompressedPhoto = null;
        if (photoFileInput) photoFileInput.value = '';
        if (photoPreviewImg) photoPreviewImg.src = '';
        if (photoPreviewBox) photoPreviewBox.style.display = 'none';
        if (photoFileLabelText) {
          photoFileLabelText.textContent = '스마트폰 또는 컴퓨터에서 사진 선택하기';
        }
      });
    }

    // 3. 사진 업로드 폼 제출
    if (photoUploadForm) {
      photoUploadForm.addEventListener('submit', function (e) {
        e.preventDefault();

        if (!currentCompressedPhoto || !currentCompressedPhoto.dataUrl) {
          alert('먼저 올리실 사진을 선택해 주세요.');
          return;
        }

        const title = photoTitleInput ? photoTitleInput.value.trim() : '';
        const rawAuthor = photoAuthorInput ? photoAuthorInput.value.trim() : '';
        const author = (rawAuthor === ADMIN_NAME || (isAdmin(currentUser) && (!rawAuthor || rawAuthor === ADMIN_NAME)))
          ? ADMIN_DISPLAY_NAME
          : rawAuthor;
        const pin = photoPinInput ? photoPinInput.value.trim() : '';

        if (!title) {
          alert('사진 제목이나 설명을 입력해 주세요.');
          if (photoTitleInput) photoTitleInput.focus();
          return;
        }

        if (!author) {
          alert('올리는 사람의 이름을 입력해 주세요.');
          if (photoAuthorInput) photoAuthorInput.focus();
          return;
        }

        if (!/^\d{4}$/.test(pin)) {
          alert('사진 삭제 시 사용할 비밀번호(숫자 4자리)를 입력해 주세요.');
          if (photoPinInput) photoPinInput.focus();
          return;
        }

        const newPhoto = {
          id: 'photo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          title: title,
          author: author,
          pin: pin,
          createdAt: formatDateTime(new Date()),
          imageData: currentCompressedPhoto.dataUrl,
          sizeBytes: currentCompressedPhoto.compressedBytes
        };

        const photos = getPhotos();
        photos.unshift(newPhoto);
        savePhotos(photos);
        cloudPushPhoto(newPhoto);

        renderPhotoGallery();

        // 폼 초기화
        currentCompressedPhoto = null;
        if (photoFileInput) photoFileInput.value = '';
        if (photoTitleInput) photoTitleInput.value = '';
        if (photoPreviewBox) photoPreviewBox.style.display = 'none';
        if (photoFileLabelText) {
          photoFileLabelText.textContent = '스마트폰 또는 컴퓨터에서 사진 선택하기';
        }

        alert('사진이 가볍게 최적화되어 파이어베이스에 성공적으로 등록되었습니다!');
      });
    }

    // 4. 사진 크게 보기 모달 닫기 이벤트
    if (photoModalClose) {
      photoModalClose.addEventListener('click', closePhotoModal);
    }
    if (photoModalBackdrop) {
      photoModalBackdrop.addEventListener('click', closePhotoModal);
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closePhotoModal();
        closeQnaAnswerModal();
      }
    });

    renderPhotoGallery();
  }

  function openPhotoModal(photo) {
    if (!photoModal || !photo) return;
    if (photoModalImg) photoModalImg.src = photo.imageData;
    if (photoModalTitle) photoModalTitle.textContent = photo.title || '나눔 사진';
    if (photoModalMeta) {
      const displayAuthor = (photo.author === ADMIN_NAME) ? ADMIN_DISPLAY_NAME : (photo.author || '익명');
      photoModalMeta.textContent = `올린이: ${displayAuthor} · 등록일: ${photo.createdAt || ''} · 용량: ${formatBytes(photo.sizeBytes || 32000)}`;
    }
    photoModal.style.display = 'flex';
  }

  function closePhotoModal() {
    if (photoModal) photoModal.style.display = 'none';
    if (photoModalImg) photoModalImg.src = '';
  }

  function renderPhotoGallery() {
    if (!photoGalleryGrid) return;

    const photos = getPhotos();

    // 총 장수 업데이트
    if (photoGalleryCount) {
      photoGalleryCount.textContent = `총 ${photos.length}장`;
    }

    if (photos.length === 0) {
      photoGalleryGrid.innerHTML = '';
      if (photoGalleryEmpty) photoGalleryEmpty.style.display = 'block';
      return;
    }

    if (photoGalleryEmpty) photoGalleryEmpty.style.display = 'none';

    let html = '';
    photos.forEach(function (photo) {
      const id = escapeHtml(photo.id);
      const title = escapeHtml(photo.title || '나눔 사진');
      const rawAuthor = (photo.author === ADMIN_NAME) ? ADMIN_DISPLAY_NAME : (photo.author || '익명');
      const author = escapeHtml(rawAuthor);
      const date = escapeHtml(photo.createdAt || '');
      const sizeStr = formatBytes(photo.sizeBytes || 32000);

      html += `
        <div class="photo-card" data-id="${id}">
          <div class="photo-card-media" data-id="${id}" title="클릭하면 사진을 크게 볼 수 있습니다">
            <img src="${photo.imageData}" alt="${title}" loading="lazy">
            <span class="photo-card-size-tag">⚡ ${sizeStr}</span>
          </div>
          <div class="photo-card-body">
            <h4 class="photo-card-title">${title}</h4>
            <div class="photo-card-meta">
              <span class="photo-card-author">${author}</span>
              <span class="photo-card-date">${date}</span>
            </div>
            <div class="photo-card-actions">
              <button type="button" class="btn-photo-view" data-id="${id}">🔍 크게 보기</button>
              <button type="button" class="btn-photo-del" data-id="${id}">🗑️ 삭제</button>
            </div>
          </div>
        </div>
      `;
    });

    photoGalleryGrid.innerHTML = html;

    // 이벤트 리스너 바인딩
    photoGalleryGrid.querySelectorAll('.photo-card-media, .btn-photo-view').forEach(function (el) {
      el.addEventListener('click', function () {
        const id = el.getAttribute('data-id');
        const photo = photos.find(p => p.id === id);
        if (photo) openPhotoModal(photo);
      });
    });

    photoGalleryGrid.querySelectorAll('.btn-photo-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-id');
        const photo = photos.find(p => p.id === id);
        if (!photo) return;

        let canDelete = false;
        if (isAdmin(currentUser)) {
          if (confirm(`[관리자 확인] "${photo.title}" 사진을 삭제하시겠습니까?`)) {
            canDelete = true;
          }
        } else {
          const inputPin = prompt(`"${photo.title}" 사진을 삭제하시려면 등록 시 입력한 비밀번호(숫자 4자리)를 입력해 주세요:`);
          if (inputPin === null) return;
          if (inputPin.trim() === String(photo.pin).trim()) {
            canDelete = true;
          } else {
            alert('비밀번호가 일치하지 않습니다.');
          }
        }

        if (canDelete) {
          const updated = photos.filter(p => p.id !== id);
          savePhotos(updated);
          cloudDeletePhoto(id);
          renderPhotoGallery();
          alert('사진이 삭제되었습니다.');
        }
      });
    });
  }

  /* ========================================================
     5. 방문자 질문과 답 (Q&A) 시스템
     ======================================================== */
  function getQnaList() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_QNA);
      const list = raw ? JSON.parse(raw) : [];
      let changed = false;
      list.forEach(function (q) {
        if (q && q.answeredBy === ADMIN_NAME) {
          q.answeredBy = ADMIN_DISPLAY_NAME;
          changed = true;
        }
        if (q && q.author === ADMIN_NAME) {
          q.author = ADMIN_DISPLAY_NAME;
          changed = true;
        }
      });
      if (changed) {
        saveQnaList(list);
      }
      return list;
    } catch (e) {
      return [];
    }
  }

  function saveQnaList(list) {
    try {
      localStorage.setItem(STORAGE_KEY_QNA, JSON.stringify(list));
    } catch (e) {}
  }

  function initQna() {
    // 1. 질문 등록 폼 제출
    if (qnaForm) {
      qnaForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const rawName = qnaNameInput ? qnaNameInput.value.trim() : '';
        const name = (rawName === ADMIN_NAME || (isAdmin(currentUser) && (!rawName || rawName === ADMIN_NAME)))
          ? ADMIN_DISPLAY_NAME
          : rawName;
        const pin = qnaPinInput ? qnaPinInput.value.trim() : '';
        const title = qnaTitleInput ? qnaTitleInput.value.trim() : '';
        const content = qnaContentInput ? qnaContentInput.value.trim() : '';

        if (!name) {
          alert('작성자 이름을 입력해 주세요.');
          if (qnaNameInput) qnaNameInput.focus();
          return;
        }

        if (!/^\d{4}$/.test(pin)) {
          alert('비밀번호는 숫자 4자리로 입력해 주세요.');
          if (qnaPinInput) qnaPinInput.focus();
          return;
        }

        if (!title) {
          alert('질문 제목을 입력해 주세요.');
          if (qnaTitleInput) qnaTitleInput.focus();
          return;
        }

        if (!content) {
          alert('질문 내용을 입력해 주세요.');
          if (qnaContentInput) qnaContentInput.focus();
          return;
        }

        const newQna = {
          id: 'qna_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          author: name,
          pin: pin,
          title: title,
          content: content,
          createdAt: formatDateTime(new Date()),
          answer: '',
          answeredAt: '',
          answeredBy: ''
        };

        const list = getQnaList();
        list.unshift(newQna);
        saveQnaList(list);
        cloudPushQna(newQna);

        renderQnaList();

        // 폼 초기화 (로그인 사용자는 이름/비번 유지)
        if (qnaTitleInput) qnaTitleInput.value = '';
        if (qnaContentInput) qnaContentInput.value = '';
        if (!currentUser) {
          if (qnaNameInput) qnaNameInput.value = '';
          if (qnaPinInput) qnaPinInput.value = '';
        }

        alert('질문이 성공적으로 등록되었습니다. 관리자가 확인 후 답변을 남겨드립니다.');
      });
    }

    // 2. 관리자 답변 모달 저장
    if (btnSaveQnaAnswer) {
      btnSaveQnaAnswer.addEventListener('click', function () {
        if (!answeringQnaId) return;

        const answerText = qnaModalAnswerInput ? qnaModalAnswerInput.value.trim() : '';
        if (!answerText) {
          alert('답변 내용을 입력해 주세요.');
          if (qnaModalAnswerInput) qnaModalAnswerInput.focus();
          return;
        }

        const list = getQnaList();
        const target = list.find(q => q.id === answeringQnaId);
        if (!target) return;

        target.answer = answerText;
        target.answeredAt = formatDateTime(new Date());
        target.answeredBy = ADMIN_DISPLAY_NAME;

        saveQnaList(list);
        cloudPushQna(target);

        renderQnaList();
        closeQnaAnswerModal();
        alert('관리자 답변이 저장 및 등록되었습니다.');
      });
    }

    // 2-1. 관리자 답변 모달 내 [답변 삭제] 버튼
    if (btnDeleteQnaAnswer) {
      btnDeleteQnaAnswer.addEventListener('click', function () {
        if (!answeringQnaId) return;

        const list = getQnaList();
        const target = list.find(q => q.id === answeringQnaId);
        if (!target) return;

        if (!confirm(`[관리자 확인]\n\n질문: "${target.title || '질문'}"\n\n등록된 관리자 답변을 삭제하시겠습니까?\n(질문 내용은 그대로 유지되며 [답변 대기중] 상태로 돌아갑니다)`)) {
          return;
        }

        delete target.answer;
        delete target.answeredAt;
        delete target.answeredBy;

        saveQnaList(list);
        cloudPushQna(target);

        renderQnaList();
        closeQnaAnswerModal();
        alert('관리자 답변이 삭제되었습니다. 질문은 [답변 대기중] 상태로 변경되었습니다.');
      });
    }

    // 3. 관리자 답변 모달 닫기
    if (btnCancelQnaAnswer) btnCancelQnaAnswer.addEventListener('click', closeQnaAnswerModal);
    if (qnaAnswerClose) qnaAnswerClose.addEventListener('click', closeQnaAnswerModal);
    if (qnaAnswerBackdrop) qnaAnswerBackdrop.addEventListener('click', closeQnaAnswerModal);

    renderQnaList();
  }

  function openQnaAnswerModal(qnaItem) {
    if (!qnaAnswerModal || !qnaItem) return;
    answeringQnaId = qnaItem.id;

    if (qnaModalQTitle) qnaModalQTitle.textContent = qnaItem.title || '질문';
    if (qnaModalQContent) qnaModalQContent.textContent = qnaItem.content || '';
    if (qnaModalAnswerInput) qnaModalAnswerInput.value = qnaItem.answer || '';

    // 기존 답변이 있으면 [답변 삭제] 버튼 표시, 신규 답변 작성이면 숨김
    if (btnDeleteQnaAnswer) {
      if (qnaItem.answer && qnaItem.answer.trim()) {
        btnDeleteQnaAnswer.style.display = 'inline-block';
      } else {
        btnDeleteQnaAnswer.style.display = 'none';
      }
    }

    qnaAnswerModal.style.display = 'flex';
    if (qnaModalAnswerInput) qnaModalAnswerInput.focus();
  }

  function closeQnaAnswerModal() {
    answeringQnaId = null;
    if (qnaAnswerModal) qnaAnswerModal.style.display = 'none';
    if (qnaModalAnswerInput) qnaModalAnswerInput.value = '';
  }

  function openQnaEditModal(qnaItem) {
    if (!qnaEditModal || !qnaItem) return;
    editingQnaId = qnaItem.id;

    if (qnaEditMetaAuthor) qnaEditMetaAuthor.textContent = `작성자: ${qnaItem.author || '익명'}`;
    if (qnaEditMetaDate) qnaEditMetaDate.textContent = `작성일시: ${qnaItem.createdAt || '-'}`;
    if (qnaEditTitleInput) qnaEditTitleInput.value = qnaItem.title || '';
    if (qnaEditContentInput) qnaEditContentInput.value = qnaItem.content || '';

    qnaEditModal.style.display = 'flex';
    if (qnaEditTitleInput) qnaEditTitleInput.focus();
  }

  function closeQnaEditModal() {
    editingQnaId = null;
    if (qnaEditModal) qnaEditModal.style.display = 'none';
    if (qnaEditTitleInput) qnaEditTitleInput.value = '';
    if (qnaEditContentInput) qnaEditContentInput.value = '';
  }

  function initQnaEditModal() {
    if (btnSaveQnaEdit) {
      btnSaveQnaEdit.addEventListener('click', function () {
        if (!editingQnaId) return;

        const newTitle = qnaEditTitleInput ? qnaEditTitleInput.value.trim() : '';
        const newContent = qnaEditContentInput ? qnaEditContentInput.value.trim() : '';

        if (!newTitle) {
          alert('질문 제목을 입력해 주세요.');
          if (qnaEditTitleInput) qnaEditTitleInput.focus();
          return;
        }

        if (!newContent) {
          alert('질문 내용을 입력해 주세요.');
          if (qnaEditContentInput) qnaEditContentInput.focus();
          return;
        }

        const list = getQnaList();
        const target = list.find(q => q.id === editingQnaId);
        if (!target) {
          alert('수정할 질문을 찾을 수 없습니다.');
          closeQnaEditModal();
          return;
        }

        target.title = newTitle;
        target.content = newContent;

        saveQnaList(list);
        cloudPushQna(target);

        renderQnaList();
        closeQnaEditModal();
        alert('질문 내용이 성공적으로 수정 및 저장되었습니다.');
      });
    }

    if (btnCancelQnaEdit) btnCancelQnaEdit.addEventListener('click', closeQnaEditModal);
    if (qnaEditClose) qnaEditClose.addEventListener('click', closeQnaEditModal);
    if (qnaEditBackdrop) qnaEditBackdrop.addEventListener('click', closeQnaEditModal);
  }

  function renderQnaList() {
    if (!qnaItemsList) return;

    const list = getQnaList();

    if (qnaListCount) {
      qnaListCount.textContent = `총 ${list.length}건`;
    }

    if (list.length === 0) {
      qnaItemsList.innerHTML = '';
      if (qnaEmptyView) qnaEmptyView.style.display = 'block';
      return;
    }

    if (qnaEmptyView) qnaEmptyView.style.display = 'none';

    let html = '';
    list.forEach(function (q) {
      const id = escapeHtml(q.id);
      const title = escapeHtml(q.title || '질문');
      const author = escapeHtml(q.author || '익명');
      const date = escapeHtml(q.createdAt || '');
      const content = escapeHtml(q.content || '');

      const hasAnswer = Boolean(q.answer && q.answer.trim());
      const badgeHtml = hasAnswer
        ? '<span class="qna-badge badge-answered">✅ 답변 완료</span>'
        : '<span class="qna-badge badge-pending">⏳ 답변 대기중</span>';

      let answerHtml = '';
      if (hasAnswer) {
        const ansDate = escapeHtml(q.answeredAt || '');
        const ansText = escapeHtml(q.answer);
        const ansAuthor = (!q.answeredBy || q.answeredBy === ADMIN_NAME) ? ADMIN_DISPLAY_NAME : q.answeredBy;

        answerHtml = `
          <div class="qna-answer-box">
            <div class="qna-answer-header">
              <span class="qna-answer-author">👑 ${escapeHtml(ansAuthor)}의 답변</span>
              <span class="qna-answer-date">${ansDate}</span>
            </div>
            <p class="qna-answer-text">${ansText}</p>
          </div>
        `;
      }

      // 관리자 또는 글쓴이가 로그인했을 때만 수정과 삭제 버튼 표시
      const isAdm = isAdmin(currentUser);
      const isAuthor = Boolean(currentUser && currentUser.name === q.author && currentUser.pin === q.pin);
      const canManage = isAdm || isAuthor;

      let actionRowHtml = '';
      if (canManage) {
        if (isAdm) {
          actionRowHtml = `
            <div class="qna-admin-action-row">
              <button type="button" class="btn-qna-answer" data-id="${id}">
                ${hasAnswer ? '✏️ 답변 수정' : '💬 답변 달기'}
              </button>
              ${hasAnswer ? `<button type="button" class="btn-admin-answer-del" data-id="${id}">🗑️ 답변만 삭제</button>` : ''}
              <button type="button" class="btn-qna-edit" data-id="${id}">✏️ 질문 수정</button>
              <button type="button" class="btn-qna-card-del" data-id="${id}">🗑️ 질문 삭제</button>
            </div>
          `;
        } else if (isAuthor) {
          actionRowHtml = `
            <div class="qna-admin-action-row">
              <button type="button" class="btn-qna-edit" data-id="${id}">✏️ 질문 수정</button>
              <button type="button" class="btn-qna-card-del" data-id="${id}">🗑️ 질문 삭제</button>
            </div>
          `;
        }
      }

      html += `
        <div class="qna-card" data-id="${id}">
          <div class="qna-header-top">
            ${badgeHtml}
            <div class="qna-meta-info">
              <span class="qna-author">${author}</span>
              <span class="qna-date">${date}</span>
              ${canManage ? `<button type="button" class="btn-qna-del" data-id="${id}" title="질문 삭제">삭제</button>` : ''}
            </div>
          </div>
          <h4 class="qna-question-title">${title}</h4>
          <p class="qna-question-body">${content}</p>
          ${answerHtml}
          ${actionRowHtml}
        </div>
      `;
    });

    qnaItemsList.innerHTML = html;

    // 1. 관리자 답변 모달 버튼 이벤트
    qnaItemsList.querySelectorAll('.btn-qna-answer').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-id');
        const item = list.find(q => q.id === id);
        if (item) openQnaAnswerModal(item);
      });
    });

    // 2. 관리자 답변만 삭제 버튼 이벤트
    qnaItemsList.querySelectorAll('.btn-admin-answer-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-id');
        const item = list.find(q => q.id === id);
        if (!item) return;

        if (!confirm(`[관리자 확인]\n\n질문: "${item.title || '질문'}"\n\n등록된 관리자 답변을 삭제하시겠습니까?\n(질문 내용은 보존되며 [답변 대기중] 상태로 돌아갑니다)`)) {
          return;
        }

        delete item.answer;
        delete item.answeredAt;
        delete item.answeredBy;

        saveQnaList(list);
        cloudPushQna(item);
        renderQnaList();
        alert('답변이 삭제되었습니다. 이제 질문은 [답변 대기중] 상태입니다.');
      });
    });

    // 3. 질문 수정 버튼 이벤트 (.btn-qna-edit) - 관리자 또는 글쓴이
    qnaItemsList.querySelectorAll('.btn-qna-edit').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-id');
        const item = list.find(q => q.id === id);
        if (item) openQnaEditModal(item);
      });
    });

    // 4. 질문 삭제 버튼 이벤트 (.btn-qna-card-del 및 .btn-qna-del) - 관리자 또는 글쓴이
    const deleteButtons = qnaItemsList.querySelectorAll('.btn-qna-card-del, .btn-qna-del');
    deleteButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-id');
        const item = list.find(q => q.id === id);
        if (!item) return;

        const isAdmUser = isAdmin(currentUser);
        const isAuthUser = Boolean(currentUser && currentUser.name === item.author && currentUser.pin === item.pin);

        if (!isAdmUser && !isAuthUser) {
          alert('글쓴이 또는 관리자만 삭제할 수 있습니다.');
          return;
        }

        const confirmMsg = isAdmUser
          ? `[관리자 확인]\n\n작성자: ${item.author || '익명'}\n질문: "${item.title || '질문'}"\n\n이 질문을 완전히 삭제하시겠습니까?\n(질문과 답변이 모두 영구 삭제되며 파이어베이스에서도 삭제됩니다)`
          : `[질문 삭제 확인]\n\n"${item.title || '질문'}" 질문을 삭제하시겠습니까?\n(삭제 시 실시간 데이터베이스에서도 완전히 삭제됩니다)`;

        if (!confirm(confirmMsg)) {
          return;
        }

        const updated = list.filter(q => q.id !== id);
        saveQnaList(updated);
        cloudDeleteQna(id);
        renderQnaList();
        alert('질문이 삭제되었습니다.');
      });
    });
  }

  /* ========================================================
     6. 국립국어원 표준국어대사전 검색창 제출 처리
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

  /* ========================================================
     7. 교육기관 스크롤 윈도우 창 제어 (좌우 버튼 및 휠 스크롤)
     ======================================================== */
  function initEduScroll() {
    const scrollWin = document.getElementById('edu-scroll-window');
    const btnPrev = document.getElementById('btn-edu-scroll-prev');
    const btnNext = document.getElementById('btn-edu-scroll-next');

    if (!scrollWin) return;

    if (btnPrev) {
      btnPrev.addEventListener('click', function () {
        scrollWin.scrollBy({ left: -226, behavior: 'smooth' });
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', function () {
        scrollWin.scrollBy({ left: 226, behavior: 'smooth' });
      });
    }

    // 마우스 휠 가로 스크롤 지원
    scrollWin.addEventListener('wheel', function (e) {
      if (e.deltaY !== 0) {
        e.preventDefault();
        scrollWin.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }

  // 초기 실행
  document.addEventListener('DOMContentLoaded', function () {
    updateDailyContent();
    scheduleMidnightUpdate();
    initCopywritingAdmin();
    initAuth();
    initWriting();
    initPostViewActions();
    initAdminPostEditModal();
    initPhotos();
    initQna();
    initQnaEditModal();
    initAttendanceDownload();
    initAdminPostsDownload();
    initSyncControls();
    initDictSearch();
    initEduScroll();
    // 페이지 로드 시 파이어베이스 실시간 데이터 동기화 시도 (백그라운드)
    fetchAndMergeCloudData(false);
  });
})();
