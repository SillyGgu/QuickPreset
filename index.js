import {
    saveSettingsDebounced,
    eventSource,
    event_types,
} from '../../../../script.js';

import {
    extension_settings,
} from '../../../extensions.js';

const extensionName = 'QuickPreset';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

const DEFAULT_SETTINGS = {
    enabled: true,
    showWandButton: true,
    presetList: [], // { name: '...', alias: '...', symbol: '...' }
    
    // 스타일 설정
    buttonSize: 50,
    buttonColor: '#6b82d8',
    
    // 위치 설정
    positionMode: 'custom', 
    customPos: { top: null, left: null, right: '20px', bottom: '150px' },
    
    moveMode: false
};

let settings = {};

// ==========================================
// 1. 요술봉(Wand) 메뉴 로직
// ==========================================
async function addToWandMenu() {
    if ($('#quick_preset_wand_button').length > 0) return;

    try {
        const buttonHtml = await $.get(`${extensionFolderPath}/button.html`);
        $("#extensionsMenu").append(buttonHtml);
        
        $("#quick_preset_wand_button").on("click", function() {
            settings.enabled = !settings.enabled;
            $('#quick_preset_enable').prop('checked', settings.enabled);
            saveSettingsDebounced();
            updateAll();
        });
        
        updateWandButtonVisibility();
        updateWandButtonStatus();
    } catch (err) {
        console.error(`[${extensionName}] Failed to add wand button`, err);
    }
}

function updateWandButtonVisibility() {
    if (settings.showWandButton) {
        $("#quick_preset_wand_button").show();
    } else {
        $("#quick_preset_wand_button").hide();
    }
}

function updateWandButtonStatus() {
    const $statusIcon = $("#quick_preset_status_icon");
    const $mainIcon = $("#quick_preset_wand_button .extensionsMenuExtensionButton");
    
    if ($statusIcon.length > 0) {
        if (settings.enabled) {
            $statusIcon.removeClass("fa-toggle-off").addClass("fa-toggle-on").css("color", "#4CAF50");
            $mainIcon.css("opacity", "1");
        } else {
            $statusIcon.removeClass("fa-toggle-on").addClass("fa-toggle-off").css("color", "#888");
            $mainIcon.css("opacity", "0.5");
        }
    }
}


// ==========================================
// 2. 메인: 플로팅 버튼 관리 (접힘/펼침 구현)
// ==========================================

function updateFloatingButtons() {
    $('#quick-preset-container').remove();

    if (!settings.enabled || !settings.presetList || settings.presetList.length === 0) {
        return;
    }

    // 컨테이너 생성
    const containerHtml = `<div id="quick-preset-container"></div>`;
    $('body').append(containerHtml);
    const $container = $('#quick-preset-container');

    // CSS 변수 적용
    $container[0].style.setProperty('--qp-size', `${settings.buttonSize}px`);
    $container[0].style.setProperty('--qp-color', settings.buttonColor);

    // 1. 위치 모드 및 앵커 결정 (위쪽 기준인지 아래쪽 기준인지)
    let isAnchorTop = false; // 기본은 아래쪽(Bottom) 기준
    let isLeftSide = false;  // 툴팁 방향 결정을 위해

    if (settings.positionMode === 'custom') {
        const topVal = settings.customPos.top;
        const bottomVal = settings.customPos.bottom;
        const leftVal = settings.customPos.left;

        // Custom 위치일 때, Top값이 설정되어 있고 auto가 아니면 Top 앵커로 간주
        // (사용자가 화면 위쪽에 두었으면 아래로 펼쳐져야 함)
        if (topVal && topVal !== 'auto') isAnchorTop = true;
        
        // 왼쪽 여백이 있으면(화면 왼쪽) 툴팁을 오른쪽으로
        if (leftVal && leftVal !== 'auto') isLeftSide = true;

        $container.css({
            top: settings.customPos.top || 'auto',
            left: settings.customPos.left || 'auto',
            bottom: settings.customPos.bottom || 'auto',
            right: settings.customPos.right || 'auto'
        });

        if (settings.moveMode) {
            $container.addClass('move-mode');
            enableDrag($container);
        }
    } else {
        // 고정 위치 프리셋
        if (settings.positionMode === 'tr') { 
            $container.css({ top: '80px', right: '20px', bottom: 'auto', left: 'auto' });
            isAnchorTop = true; 
        } else if (settings.positionMode === 'tl') {
            $container.css({ top: '80px', left: '20px', bottom: 'auto', right: 'auto' });
            isAnchorTop = true;
            isLeftSide = true;
        } else if (settings.positionMode === 'bl') {
            $container.css({ bottom: '20px', left: '20px', top: 'auto', right: 'auto' });
            isLeftSide = true;
        } else { // br (default)
            $container.css({ bottom: '20px', right: '20px', top: 'auto', left: 'auto' });
        }
    }

    // 2. 클래스 부여 (CSS Flex 방향 제어용)
    $container.addClass(isAnchorTop ? 'anchor-top' : 'anchor-bottom');
    if (isLeftSide) $container.addClass('pos-left');

    // 3. 메인 버튼 (항상 보임)
    // 아이콘: 메뉴 모양 (bars) 혹은 레이어 모양
    const $mainBtn = $(`
        <div class="quick-preset-main-btn" title="프리셋 메뉴">
            <i class="fa-solid fa-bars"></i>
        </div>
    `);

    // 4. 프리셋 리스트 래퍼 (평소 숨김, 호버시 보임)
    const $listWrapper = $(`<div class="quick-preset-list-wrapper"></div>`);

    settings.presetList.forEach((preset, index) => {
        let displayText = '';
        if (preset.symbol && preset.symbol.trim() !== '') {
            displayText = preset.symbol; 
        } else if (preset.alias && preset.alias.trim() !== '') {
            displayText = preset.alias.substring(0, 2); 
        } else {
            displayText = preset.name.substring(0, 2);
        }

        let tooltipText = (preset.alias && preset.alias.trim() !== '') ? preset.alias : preset.name;

        const btnHtml = `
            <div class="quick-preset-btn" data-fullname="${tooltipText}" data-index="${index}">
                <span>${displayText}</span>
            </div>
        `;
        $listWrapper.append(btnHtml);
    });

    // 5. DOM 조립
    // anchor-bottom(하단 고정)일 때: [리스트 래퍼] -> [메인 버튼] 순서로 넣음 (CSS에서 flex-direction: column-reverse로 처리하여 메인이 아래로 감)
    // anchor-top(상단 고정)일 때: [메인 버튼] -> [리스트 래퍼] (CSS flex-direction: column)
    // => HTML 구조는 동일하게 넣고 CSS flex-direction으로 순서만 바꾸는 게 깔끔함.
    
    // 하지만 CSS의 visual order와 상관없이 스크린리더나 논리적 순서를 위해
    // HTML에 "메인 버튼" -> "리스트" 순서로 넣고 CSS로 제어하겠습니다.
    $container.append($listWrapper);
    $container.append($mainBtn);


    // 이벤트 바인딩
    $container.find('.quick-preset-btn').on('click', function(e) {
        if (settings.positionMode === 'custom' && settings.moveMode) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        const index = $(this).data('index');
        const presetData = settings.presetList[index];
        applyPreset(presetData);
    });
}

function enableDrag($element) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    $element.on('mousedown', function(e) {
        if (!settings.moveMode) return;
        
        isDragging = true;
        const rect = $element[0].getBoundingClientRect();
        
        startLeft = rect.left;
        startTop = rect.top;
        startX = e.clientX;
        startY = e.clientY;

        $(document).on('mousemove.qp_drag', function(moveEvent) {
            if (!isDragging) return;
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;
            $element.css({ left: (startLeft + deltaX) + 'px', top: (startTop + deltaY) + 'px', right: 'auto', bottom: 'auto' });
        });

        $(document).on('mouseup.qp_drag', function() {
            if (isDragging) {
                isDragging = false;
                $(document).off('mousemove.qp_drag mouseup.qp_drag');
                const rect = $element[0].getBoundingClientRect();
                
                // 위치 저장 시 top/bottom 판별 로직
                // 화면 절반보다 위에 있으면 Top 기준, 아래면 Bottom 기준으로 저장하면 반응형에 유리할 수 있으나
                // 단순화를 위해 현재 좌표 그대로 저장합니다.
                settings.customPos = { top: rect.top + 'px', left: rect.left + 'px', bottom: 'auto', right: 'auto' };
                saveSettingsDebounced();
                // 드래그 후 위치에 따라 펼쳐지는 방향 재계산을 위해 업데이트
                updateFloatingButtons(); 
            }
        });
        e.preventDefault();
    });
}

function applyPreset(presetData) {
    const $stDropdown = $('#settings_preset_openai');
    const targetName = presetData.name;
    const displayName = (presetData.alias && presetData.alias.trim() !== '') ? presetData.alias : targetName;

    if ($stDropdown.length === 0) {
        toastr.error('Chat Completion 설정을 찾을 수 없습니다.');
        return;
    }
    
    $stDropdown.val(targetName);
    if ($stDropdown.val() !== targetName) {
        toastr.warning(`프리셋 "${displayName}"(원본: ${targetName})을(를) 찾을 수 없습니다.`);
        return;
    }
    
    $stDropdown.trigger('change');
    toastr.success(`[${displayName}] 적용 완료`);
}


// ==========================================
// 3. 설정창(Settings) UI 로직
// ==========================================

function syncPresetOptions() {
    const $stDropdown = $('#settings_preset_openai');
    const $myDropdown = $('#quick_preset_selector');
    if ($stDropdown.length === 0 || $myDropdown.length === 0) return;

    $myDropdown.empty();
    $myDropdown.append('<option value="">-- 프리셋 선택 --</option>');

    $stDropdown.find('option').each(function() {
        const val = $(this).val();
        const text = $(this).text();
        if (val && val !== 'gui') { 
            $myDropdown.append(new Option(text, val));
        }
    });
}

function renderPresetListUI() {
    const $listContainer = $('#quick_preset_list_container');
    $listContainer.empty();

    if (!settings.presetList || settings.presetList.length === 0) {
        $listContainer.append('<div style="text-align: center; color: #888;">목록이 비어있습니다.</div>');
        return;
    }

    settings.presetList.forEach((preset, index) => {
        const alias = preset.alias || '';
        const symbol = preset.symbol || '';
        const isFirst = index === 0;
        const isLast = index === settings.presetList.length - 1;
        
        const itemHtml = `
            <div class="preset-list-item">
                <div style="display:flex; flex-direction:column; gap:2px; align-items: center;">
                    <button class="menu_button preset-move-btn" data-dir="up" data-index="${index}" ${isFirst ? 'disabled style="opacity:0.3"' : ''} title="위로 이동">
                        <i class="fa-solid fa-chevron-up"></i>
                    </button>
                    <button class="menu_button preset-move-btn" data-dir="down" data-index="${index}" ${isLast ? 'disabled style="opacity:0.3"' : ''} title="아래로 이동">
                        <i class="fa-solid fa-chevron-down"></i>
                    </button>
                </div>

                <div style="flex:1; display:flex; flex-direction:column; gap:2px;">
                    <div style="font-size:0.8em; color:#aaa; margin-bottom: 2px;">원본: ${preset.name}</div>
                    <div style="display:flex; gap: 5px;">
                        <input type="text" class="preset-symbol-input" data-index="${index}" 
                               style="width: 60px; text-align:center;"
                               placeholder="모양" value="${symbol}" title="버튼 글자/이모지">
                        <input type="text" class="preset-alias-input" data-index="${index}" 
                               style="flex:1;"
                               placeholder="별칭" value="${alias}" title="설명(툴팁)">
                    </div>
                </div>
                
                <button class="preset-delete-btn menu_button" style="color: #e74c3c; height: fit-content; align-self: center;" data-index="${index}" title="삭제">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        $listContainer.append(itemHtml);
    });

    // 이벤트 리스너
    $('.preset-alias-input').on('input', function() {
        const index = $(this).data('index');
        settings.presetList[index].alias = $(this).val();
        saveSettingsDebounced();
        updateFloatingButtons(); // 실시간 반영
    });

    $('.preset-symbol-input').on('input', function() {
        const index = $(this).data('index');
        settings.presetList[index].symbol = $(this).val();
        saveSettingsDebounced();
        updateFloatingButtons();
    });

    $('.preset-delete-btn').on('click', function() {
        const index = $(this).data('index');
        settings.presetList.splice(index, 1);
        saveSettingsDebounced();
        renderPresetListUI();
        updateFloatingButtons();
    });

    // 순서 변경 버튼 로직
    $('.preset-move-btn').on('click', function() {
        const index = $(this).data('index');
        const dir = $(this).data('dir');
        
        if (dir === 'up' && index > 0) {
            // Swap
            [settings.presetList[index], settings.presetList[index - 1]] = 
            [settings.presetList[index - 1], settings.presetList[index]];
        } else if (dir === 'down' && index < settings.presetList.length - 1) {
            // Swap
            [settings.presetList[index], settings.presetList[index + 1]] = 
            [settings.presetList[index + 1], settings.presetList[index]];
        } else {
            return;
        }

        saveSettingsDebounced();
        renderPresetListUI();
        updateFloatingButtons();
    });
}

function updateAll() {
    updateWandButtonStatus();
    updateFloatingButtons();
}

function onSettingChange() {
    settings.enabled = $('#quick_preset_enable').prop('checked');
    settings.showWandButton = $('#quick_preset_show_wand').prop('checked');
    
    settings.buttonSize = parseInt($('#quick_preset_size').val()) || 50;
    settings.buttonColor = $('#quick_preset_color').val();
    
    settings.positionMode = $('#quick_preset_position_mode').val();
    settings.moveMode = $('#quick_preset_move_mode').prop('checked');

    if (settings.positionMode === 'custom') {
        $('#quick_preset_move_toggle_area').slideDown();
    } else {
        $('#quick_preset_move_toggle_area').slideUp();
        settings.moveMode = false;
        $('#quick_preset_move_mode').prop('checked', false);
    }

    updateWandButtonVisibility();
    saveSettingsDebounced();
    updateAll();
}

// ==========================================
// 4. 초기화
// ==========================================
(async function() {
    settings = extension_settings[extensionName] = extension_settings[extensionName] || DEFAULT_SETTINGS;
    
    if (!Array.isArray(settings.presetList)) settings.presetList = [];
    if (!settings.customPos) settings.customPos = DEFAULT_SETTINGS.customPos;
    if (settings.showWandButton === undefined) settings.showWandButton = true;
    
    if (['br', 'bl'].includes(settings.positionMode)) {
        settings.positionMode = 'custom';
    }
    if (!settings.positionMode) settings.positionMode = 'custom';

    await addToWandMenu();
    updateFloatingButtons();

    const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
    $("#extensions_settings2").append(settingsHtml);

    $('#quick_preset_enable, #quick_preset_show_wand, #quick_preset_move_mode').on('change', onSettingChange);
    $('#quick_preset_size, #quick_preset_color, #quick_preset_position_mode').on('input change', onSettingChange);
    
    $('#quick_preset_refresh_btn').on('click', () => {
        syncPresetOptions();
        toastr.info('프리셋 목록 갱신됨');
    });

    $('#quick_preset_add_btn').on('click', () => {
        const val = $('#quick_preset_selector').val();
        if (!val) return toastr.warning('선택된 프리셋이 없습니다.');
        if (settings.presetList.some(p => p.name === val)) return toastr.info('이미 추가된 프리셋입니다.');
        
        settings.presetList.push({ name: val, alias: '', symbol: '' });
        saveSettingsDebounced();
        renderPresetListUI();
        updateFloatingButtons();
    });

    $('#quick_preset_enable').prop('checked', settings.enabled);
    $('#quick_preset_show_wand').prop('checked', settings.showWandButton);
    $('#quick_preset_size').val(settings.buttonSize);
    $('#quick_preset_color').val(settings.buttonColor);
    $('#quick_preset_position_mode').val(settings.positionMode);
    $('#quick_preset_move_mode').prop('checked', settings.moveMode);
    
    if (settings.positionMode === 'custom') $('#quick_preset_move_toggle_area').show();

    renderPresetListUI();
    setTimeout(syncPresetOptions, 2000);

    console.log(`[${extensionName}] loaded v2.3.`);
})();