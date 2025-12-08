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
    presetList: [], 
    
    // 스타일 설정
    buttonSize: 50,
    buttonColor: '#6b82d8',
    
    // 위치 설정
    positionMode: 'custom', 
    customPos: { top: null, left: null, right: '20px', bottom: '150px' },
    
    moveMode: false,
    expandDown: false // [추가] 기본값: 위로 펼침(false)
};

let settings = {};

// ... (addToWandMenu 등 기존 코드 유지) ...

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

    // [추가] 아래로 펼치기 클래스 적용
    if (settings.expandDown) {
        $container.addClass('expand-down');
    }

    // 1. 위치 모드 및 앵커 결정 (위쪽 기준인지 아래쪽 기준인지)
    let isAnchorTop = false; 
    let isLeftSide = false;

    if (settings.positionMode === 'custom') {
        const topVal = settings.customPos.top;
        const leftVal = settings.customPos.left;

        if (topVal && topVal !== 'auto') isAnchorTop = true;
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

    $container.addClass(isAnchorTop ? 'anchor-top' : 'anchor-bottom');
    if (isLeftSide) $container.addClass('pos-left');

    const $mainBtn = $(`
        <div class="quick-preset-main-btn" title="프리셋 메뉴">
            <i class="fa-solid fa-bars"></i>
        </div>
    `);

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

    $container.append($listWrapper);
    $container.append($mainBtn);


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

// ... (enableDrag, applyPreset 등 기존 함수 유지) ...

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
                
                settings.customPos = { top: rect.top + 'px', left: rect.left + 'px', bottom: 'auto', right: 'auto' };
                saveSettingsDebounced();
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


// ... (설정 UI 로직) ...

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
            [settings.presetList[index], settings.presetList[index - 1]] = 
            [settings.presetList[index - 1], settings.presetList[index]];
        } else if (dir === 'down' && index < settings.presetList.length - 1) {
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
    
    // [추가] 아래로 펼치기 값 읽기
    settings.expandDown = $('#quick_preset_expand_down').prop('checked');

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

(async function() {
    settings = extension_settings[extensionName] = extension_settings[extensionName] || DEFAULT_SETTINGS;
    
    if (!Array.isArray(settings.presetList)) settings.presetList = [];
    if (!settings.customPos) settings.customPos = DEFAULT_SETTINGS.customPos;
    if (settings.showWandButton === undefined) settings.showWandButton = true;
    if (settings.expandDown === undefined) settings.expandDown = false; // [추가] 초기화

    if (['br', 'bl'].includes(settings.positionMode)) {
        settings.positionMode = 'custom';
    }
    if (!settings.positionMode) settings.positionMode = 'custom';

    await addToWandMenu();
    updateFloatingButtons();

    const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
    $("#extensions_settings2").append(settingsHtml);

    // [수정] 이벤트 리스너에 #quick_preset_expand_down 추가
    $('#quick_preset_enable, #quick_preset_show_wand, #quick_preset_move_mode, #quick_preset_expand_down').on('change', onSettingChange);
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
    
    // [추가] 초기 체크박스 상태 반영
    $('#quick_preset_expand_down').prop('checked', settings.expandDown);
    
    if (settings.positionMode === 'custom') $('#quick_preset_move_toggle_area').show();

    renderPresetListUI();
    setTimeout(syncPresetOptions, 2000);

    console.log(`[${extensionName}] loaded v2.3.`);
})();