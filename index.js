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
    buttonColor: '#fade85',
    symbolStrokeColor: '#000000',

    // 위치 설정
    positionMode: 'custom',
    customPos: { top: null, left: null, right: '20px', bottom: '150px' },

    moveMode: false,
    expandDown: false
};
let settings = {};


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
    $container[0].style.setProperty('--qp-theme-soft', '#e5f5eb');
    $container[0].style.setProperty('--qp-symbol-stroke', settings.symbolStrokeColor || '#000000');

    if (settings.expandDown) {
        $container.addClass('expand-down');
    }

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
        } else { 
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
                <span class="qp-symbol">${displayText}</span>
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

    let foundValue = null;
    $stDropdown.find('option').each(function() {
        if ($(this).text().trim() === targetName) {
            foundValue = $(this).val();
            return false; 
        }
    });

    if (foundValue !== null) {
        $stDropdown.val(foundValue).trigger('change');
        toastr.success(`[${displayName}] 적용 완료`);
    } else {
        toastr.warning(`프리셋 "${displayName}"을(를) 목록에서 찾을 수 없습니다.`);
    }
}

function syncPresetOptions() {
    const $stDropdown = $('#settings_preset_openai');
    const $myDropdown = $('#quick_preset_selector');
    if ($stDropdown.length === 0 || $myDropdown.length === 0) return;

    $myDropdown.empty();
    $myDropdown.append('<option value="">-- 프리셋 선택 --</option>');

    $stDropdown.find('option').each(function() {
        const text = $(this).text().trim();
        const val = $(this).val();
        
        if (val && val !== 'gui') { 
            $myDropdown.append(new Option(text, text));
        }
    });
}

function renderPresetListUI() {
    const $listContainer = $('#quick_preset_list_container');
    if (!$listContainer.data('resize-init')) {
        $listContainer.data('resize-init', true);

        // 핸들 엘리먼트를 컨테이너 바깥 아래에 붙임
        if ($listContainer.next('.preset-list-resize-handle').length === 0) {
            $listContainer.after('<div class="preset-list-resize-handle"></div>');
        }
        const $handle = $listContainer.next('.preset-list-resize-handle');

        let isResizing = false;
        let startY, startHeight;

        $handle.on('mousedown', function(e) {
            isResizing = true;
            startY = e.clientY;
            startHeight = $listContainer.outerHeight();
            e.preventDefault();
        });

        $(document).on('mousemove.qp_resize', function(e) {
            if (!isResizing) return;
            const delta = e.clientY - startY;
            const newHeight = Math.max(150, Math.min(600, startHeight + delta));
            $listContainer.css('height', newHeight + 'px');
        });

        $(document).on('mouseup.qp_resize', function() {
            isResizing = false;
        });
    }
    $listContainer.empty();

    if (!settings.presetList || settings.presetList.length === 0) {
        $listContainer.append('<div style="text-align: center; color: #888;">목록이 비어있습니다.</div>');
        return;
    }

    // 교체용 셀렉트 옵션 목록 미리 수집 (SillyTavern 드롭다운에서)
    const $stDropdown = $('#settings_preset_openai');
    let allPresetOptions = '';
    $stDropdown.find('option').each(function() {
        const text = $(this).text().trim();
        const val = $(this).val();
        if (val && val !== 'gui') {
            allPresetOptions += `<option value="${text}">${text}</option>`;
        }
    });

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
                    <select class="preset-name-select" data-index="${index}" style="width:100%; margin-bottom:4px; height:32px; font-size:12px; border-radius:8px; border:1px solid #d6ddd8; background:#f9fdfb; padding:0 8px; color:#4a4a4a;">
                        ${allPresetOptions}
                    </select>
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

    // 셀렉트 초기값 세팅 
    settings.presetList.forEach((preset, index) => {
        $(`.preset-name-select[data-index="${index}"]`).val(preset.name);
    });

    // 프리셋 교체 셀렉트 이벤트
    $('.preset-name-select').on('change', function() {
        const index = $(this).data('index');
        const newName = $(this).val();
        if (!newName) return;
        // 다른 슬롯에서 이미 쓰고 있는지 확인
        const duplicate = settings.presetList.some((p, i) => i !== index && p.name === newName);
        if (duplicate) {
            toastr.warning('이미 목록에 있는 프리셋입니다.');
            $(this).val(settings.presetList[index].name); 
            return;
        }
        settings.presetList[index].name = newName;
        saveSettingsDebounced();
        updateFloatingButtons();
        toastr.success(`교체됨: ${newName}`);
    });

    // 이벤트 리스너
    $('.preset-alias-input').on('input', function() {
        const index = $(this).data('index');
        settings.presetList[index].alias = $(this).val();
        saveSettingsDebounced();
        updateFloatingButtons();
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
    settings.symbolStrokeColor = $('#quick_preset_symbol_stroke_color').val();
	
    settings.positionMode = $('#quick_preset_position_mode').val();
    settings.moveMode = $('#quick_preset_move_mode').prop('checked');
    
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
    if (settings.expandDown === undefined) settings.expandDown = false; 

    if (['br', 'bl'].includes(settings.positionMode)) {
        settings.positionMode = 'custom';
    }
    if (!settings.positionMode) settings.positionMode = 'custom';

    await addToWandMenu();
    updateFloatingButtons();

    const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
    $("#extensions_settings2").append(settingsHtml);

    $('#quick_preset_enable, #quick_preset_show_wand, #quick_preset_move_mode, #quick_preset_expand_down').on('change', onSettingChange);
    $('#quick_preset_size, #quick_preset_position_mode').on('input change', onSettingChange);

    $('#quick_preset_color').on('input', function() {
        settings.buttonColor = $(this).val();
        const $c = $('#quick-preset-container');
        if ($c.length) $c[0].style.setProperty('--qp-color', settings.buttonColor);
    });
    $('#quick_preset_color').on('change', onSettingChange);

    $('#quick_preset_symbol_stroke_color').on('input', function() {
        settings.symbolStrokeColor = $(this).val();
        const $c = $('#quick-preset-container');
        if ($c.length) $c[0].style.setProperty('--qp-symbol-stroke', settings.symbolStrokeColor);
    });
    $('#quick_preset_symbol_stroke_color').on('change', onSettingChange);
    
    $('#quick_preset_refresh_btn').on('click', () => {
        syncPresetOptions();
        renderPresetListUI();
        toastr.info('프리셋 목록 갱신됨');
    });

    $('#quick_preset_add_btn').on('click', () => {
        const val = $('#quick_preset_selector').val(); 
        
        if (!val) {
            return toastr.warning('선택된 프리셋이 없습니다.');
        }

        if (settings.presetList.some(p => p.name === val)) {
            return toastr.info('이미 추가된 프리셋입니다.');
        }
        
        settings.presetList.push({ name: val, alias: '', symbol: '' });
        saveSettingsDebounced();
        renderPresetListUI();
        updateFloatingButtons();
        toastr.success(`추가됨: ${val}`);
    });

    $('#quick_preset_enable').prop('checked', settings.enabled);
    $('#quick_preset_show_wand').prop('checked', settings.showWandButton);
    $('#quick_preset_size').val(settings.buttonSize);
    $('#quick_preset_color').val(settings.buttonColor);
    $('#quick_preset_symbol_stroke_color').val(settings.symbolStrokeColor || '#000000');
    $('#quick_preset_position_mode').val(settings.positionMode);
    $('#quick_preset_move_mode').prop('checked', settings.moveMode);
    
    $('#quick_preset_expand_down').prop('checked', settings.expandDown);
    
    if (settings.positionMode === 'custom') $('#quick_preset_move_toggle_area').show();

    renderPresetListUI();
    setTimeout(syncPresetOptions, 2000);

    console.log(`[${extensionName}] loaded v2.3.`);
})();