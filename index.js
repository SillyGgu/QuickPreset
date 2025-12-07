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
    positionMode: 'br', // br, bl, tr, tl, custom
    customPos: { top: null, left: null, right: '20px', bottom: '20px' }, // 커스텀 좌표
    
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
// 2. 메인: 플로팅 버튼 관리 & 드래그
// ==========================================

function updateFloatingButtons() {
    $('#quick-preset-container').remove();

    if (!settings.enabled || !settings.presetList || settings.presetList.length === 0) {
        return;
    }

    const containerHtml = `<div id="quick-preset-container"></div>`;
    $('body').append(containerHtml);
    const $container = $('#quick-preset-container');

    $container[0].style.setProperty('--qp-size', `${settings.buttonSize}px`);
    $container[0].style.setProperty('--qp-color', settings.buttonColor);

    $container.removeClass('pos-tl pos-tr pos-bl pos-br move-mode');
    
    if (settings.positionMode === 'custom') {
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
        $container.addClass(`pos-${settings.positionMode}`);
        $container.css({ top: '', left: '', bottom: '', right: '' });
    }

    settings.presetList.forEach((preset, index) => {
        // 1. 버튼에 표시될 텍스트 (symbol 우선 -> alias -> name)
        let displayText = '';
        if (preset.symbol && preset.symbol.trim() !== '') {
            displayText = preset.symbol; 
        } else if (preset.alias && preset.alias.trim() !== '') {
            displayText = preset.alias.substring(0, 2); 
        } else {
            displayText = preset.name.substring(0, 2);
        }

        // 2. 툴팁에 표시될 텍스트 (alias 우선 -> name)
        // CSS에서 attr(data-fullname)을 사용하므로 여기에 표시하고 싶은 텍스트를 넣습니다.
        let tooltipText = (preset.alias && preset.alias.trim() !== '') ? preset.alias : preset.name;

        const btnHtml = `
            <div class="quick-preset-btn" data-fullname="${tooltipText}" data-index="${index}">
                <span>${displayText}</span>
            </div>
        `;
        $container.append(btnHtml);
    });

    $('.quick-preset-btn').on('click', function(e) {
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
            }
        });
        e.preventDefault();
    });
}

function applyPreset(presetData) {
    const $stDropdown = $('#settings_preset_openai');
    const targetName = presetData.name;
    // 표시용 이름: 별칭이 있으면 별칭, 없으면 원래 이름
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
    // 요청사항 2: 완료 메시지에 별칭 띄우기
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
        
        // 요청사항 3: 버튼 텍스트(심볼)와 별칭을 따로 설정하는 UI
        const itemHtml = `
            <div class="preset-list-item">
                <div style="flex:1; display:flex; flex-direction:column; gap:2px;">
                    <div style="font-size:0.8em; color:#aaa; margin-bottom: 2px;">원본: ${preset.name}</div>
                    <div style="display:flex; gap: 5px;">
                        <input type="text" class="preset-symbol-input" data-index="${index}" 
                               style="width: 60px; text-align:center;"
                               placeholder="버튼모양" value="${symbol}" title="버튼 위에 표시될 짧은 텍스트나 이모지 (예: ❤️)">
                        <input type="text" class="preset-alias-input" data-index="${index}" 
                               style="flex:1;"
                               placeholder="별칭 (툴팁/알림용)" value="${alias}" title="마우스 오버 및 적용 완료 시 표시될 이름">
                    </div>
                </div>
                <button class="preset-delete-btn menu_button" style="color: #e74c3c; height: fit-content; align-self: center;" data-index="${index}">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        $listContainer.append(itemHtml);
    });

    // 입력 이벤트 (별칭)
    $('.preset-alias-input').on('input', function() {
        const index = $(this).data('index');
        settings.presetList[index].alias = $(this).val();
        saveSettingsDebounced();
        updateFloatingButtons();
    });

    // 입력 이벤트 (버튼 심볼)
    $('.preset-symbol-input').on('input', function() {
        const index = $(this).data('index');
        settings.presetList[index].symbol = $(this).val();
        saveSettingsDebounced();
        updateFloatingButtons();
    });

    // 삭제 버튼
    $('.preset-delete-btn').on('click', function() {
        const index = $(this).data('index');
        settings.presetList.splice(index, 1);
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
    
    // 데이터 마이그레이션
    if (!Array.isArray(settings.presetList)) settings.presetList = [];
    if (!settings.customPos) settings.customPos = DEFAULT_SETTINGS.customPos;
    if (settings.showWandButton === undefined) settings.showWandButton = true;
    if (!settings.positionMode) settings.positionMode = 'br';

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
        
        // 초기 추가 시 symbol은 비워둡니다.
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

    console.log(`[${extensionName}] loaded v2.1.`);
})();