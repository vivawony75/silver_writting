/**
 * 글 짓는 부엌 - 첨부 데이터 기반 일자별 베껴쓰기 및 매일 0시 자동 갱신 스크립트
 * 기능: A열 날짜에 해당하는 B열 내용을 매일 0시에 자동으로 화면에 반영
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

  // DOM 요소
  const dateElement = document.getElementById('copywriting-date');
  const contentElement = document.getElementById('copywriting-content');

  let lastLoadedDay = null;

  /**
   * 오늘 날짜에 해당하는 내용을 화면에 반영
   */
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

    // A열 날짜가 오늘(todayKey)과 일치하는 항목 검색
    const matchedItem = writingSchedule.find(function (item) {
      return item.date === todayKey;
    });

    if (contentElement) {
      if (matchedItem && matchedItem.content && matchedItem.content.trim()) {
        contentElement.textContent = matchedItem.content.trim();
      } else {
        // 오늘 날짜 데이터가 비어있거나 아직 없는 경우, 등록된 유효 글귀 중 최신 글귀 표시
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

  /**
   * 매일 자정(0시 0분 0.5초)에 자동으로 콘텐츠를 갱신하는 타이머
   */
  function scheduleMidnightUpdate() {
    const now = new Date();
    // 다음 날 0시 0분 0.5초 계산
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0, 0, 0, 500
    );

    const msUntilMidnight = Math.max(1000, nextMidnight.getTime() - now.getTime());

    setTimeout(function () {
      updateDailyContent();
      scheduleMidnightUpdate(); // 다음 날 자정 타이머 재설정
    }, msUntilMidnight);
  }

  /**
   * 화면 복귀나 탭 활성화 시 날짜 변경 여부 확인 후 자동 갱신
   */
  function checkDayChange() {
    const currentDay = new Date().getDate();
    if (lastLoadedDay !== null && currentDay !== lastLoadedDay) {
      updateDailyContent();
    }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      checkDayChange();
    }
  });

  window.addEventListener('focus', function () {
    checkDayChange();
  });

  // 10초 간격으로 일자 변경 감지 (시스템 절전 복귀 등 대응)
  setInterval(checkDayChange, 10000);

  /**
   * 국립국어원 표준국어대사전 검색창 제출 처리
   */
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
    initDictSearch();
  });
})();
