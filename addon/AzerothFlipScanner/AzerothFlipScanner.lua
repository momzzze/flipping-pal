local ADDON_NAME = ...
local DEFAULT_REGION = 'US'
local MAX_SCAN_RESULTS = 200000
local REPLICATE_COOLDOWN_SECONDS = 15 * 60

local addon = {
  auctionHouseOpen = false,
  isScanning = false,
}

local function ensureDatabase()
  if type(AzerothFlipScannerDB) ~= 'table' then
    AzerothFlipScannerDB = {}
  end

  AzerothFlipScannerDB.schemaVersion = 1
  AzerothFlipScannerDB.scans = AzerothFlipScannerDB.scans or {}
  AzerothFlipScannerDB.region = DEFAULT_REGION
end

ensureDatabase()

local function setStatus(message)
  if addon.statusText then
    addon.statusText:SetText(message)
  end
end

local function printMessage(message)
  DEFAULT_CHAT_FRAME:AddMessage('|cff70c0ffAzeroth Flip:|r ' .. message)
end

local function getItemId(fallbackItemId, itemLink)
  if fallbackItemId and fallbackItemId > 0 then
    return fallbackItemId
  end

  if not itemLink then
    return nil
  end

  local itemId = itemLink:match('item:(%d+)')
  return itemId and tonumber(itemId) or nil
end

local function collectScan()
  local auctionApi = C_AuctionHouse
  local totalCount
  local firstIndex
  local getAuctionInfo
  local getAuctionLink
  if auctionApi and type(auctionApi.GetNumReplicateItems) == 'function'
    and type(auctionApi.GetReplicateItemInfo) == 'function' then
    totalCount = tonumber(auctionApi.GetNumReplicateItems()) or 0
    firstIndex = 0
    getAuctionInfo = function(index)
      return auctionApi.GetReplicateItemInfo(index)
    end
    getAuctionLink = function(index)
      if type(auctionApi.GetReplicateItemLink) == 'function' then
        return auctionApi.GetReplicateItemLink(index)
      end
    end
  else
    local batchCount, reportedCount = GetNumAuctionItems('list')
    batchCount = tonumber(batchCount) or 0
    totalCount = tonumber(reportedCount) or batchCount
    firstIndex = 1
    totalCount = math.min(batchCount, totalCount)
    getAuctionInfo = function(index)
      return GetAuctionItemInfo('list', index)
    end
    getAuctionLink = function(index)
      return GetAuctionItemLink('list', index)
    end
  end

  local rowCount = math.min(totalCount, MAX_SCAN_RESULTS)
  local itemsById = {}
  local listingsWithBuyout = 0
  local skippedNoBuyout = 0
  local skippedNoItemId = 0

  for offset = 0, rowCount - 1 do
    local index = firstIndex + offset
    local name, _, quantity, _, _, _, _, _, _, buyoutPrice, _, _, _, _, _, _, itemId =
      getAuctionInfo(index)

    quantity = tonumber(quantity) or 0
    buyoutPrice = tonumber(buyoutPrice) or 0
    itemId = getItemId(tonumber(itemId), getAuctionLink(index))

    if not itemId then
      skippedNoItemId = skippedNoItemId + 1
    elseif quantity < 1 or buyoutPrice < 1 then
      skippedNoBuyout = skippedNoBuyout + 1
    else
      local unitPrice = math.floor(buyoutPrice / quantity)
      local item = itemsById[itemId]
      if not item then
        item = {
          itemId = itemId,
          name = name or ('Item ' .. itemId),
          totalQuantity = 0,
          listingCount = 0,
          tiersByUnitPrice = {},
        }
        itemsById[itemId] = item
      elseif name and (not item.name or item.name == ('Item ' .. itemId)) then
        item.name = name
      end

      local tier = item.tiersByUnitPrice[unitPrice]
      if not tier then
        tier = { unitPriceCopper = unitPrice, quantity = 0, listingCount = 0 }
        item.tiersByUnitPrice[unitPrice] = tier
      end
      tier.quantity = tier.quantity + quantity
      tier.listingCount = tier.listingCount + 1
      item.totalQuantity = item.totalQuantity + quantity
      item.listingCount = item.listingCount + 1
      listingsWithBuyout = listingsWithBuyout + 1
    end
  end

  local itemRows = {}
  for _, item in pairs(itemsById) do
    local tiers = {}
    for _, tier in pairs(item.tiersByUnitPrice) do
      tiers[#tiers + 1] = tier
    end
    table.sort(tiers, function(left, right)
      return left.unitPriceCopper < right.unitPriceCopper
    end)

    item.tiersByUnitPrice = nil
    item.priceTiers = tiers
    itemRows[#itemRows + 1] = item
  end
  table.sort(itemRows, function(left, right)
    return left.itemId < right.itemId
  end)

  local version, build, buildDate, interfaceVersion = GetBuildInfo()
  local scannedAt = time()
  local scan = {
    scanId = tostring(scannedAt) .. '-' .. tostring(#AzerothFlipScannerDB.scans + 1),
    game = 'Classic Forever',
    region = AzerothFlipScannerDB.region,
    realm = GetRealmName(),
    locale = GetLocale(),
    clientVersion = version,
    clientBuild = build,
    clientBuildDate = buildDate,
    interfaceVersion = interfaceVersion,
    scannedAt = scannedAt,
    totalAuctionCount = totalCount,
    capturedAuctionCount = rowCount,
    itemCount = #itemRows,
    listingsWithBuyout = listingsWithBuyout,
    skippedNoBuyout = skippedNoBuyout,
    skippedNoItemId = skippedNoItemId,
    truncated = totalCount > rowCount,
    items = itemRows,
  }

  AzerothFlipScannerDB.scans[#AzerothFlipScannerDB.scans + 1] = scan
  AzerothFlipScannerDB.latestScanId = scan.scanId
  return scan
end

local function isAuctionHouseVisible()
  if addon.auctionHouseOpen then
    return true
  end

  local frameNames = {
    'AuctionHouseFrame',
    'AuctionFrame',
    'AuctionFrameBrowse',
  }
  for _, frameName in ipairs(frameNames) do
    local frame = _G[frameName]
    if frame and frame.IsVisible and frame:IsVisible() then
      return true
    end
  end
  return false
end

local function onAuctionResults()
  if not addon.isScanning then
    return
  end

  addon.isScanning = false
  addon.startButton:Enable()

  local scan = collectScan()
  local truncatedMessage = scan.truncated and ' Results hit the client limit.' or ''
  local summary = string.format(
    'Saved %d item IDs from %d buyout listings on %s.%s',
    scan.itemCount,
    scan.listingsWithBuyout,
    scan.realm or 'unknown realm',
    truncatedMessage
  )
  setStatus(summary)
  printMessage(summary .. ' Use /reload or log out to write SavedVariables to disk.')
end

local function startScan()
  printMessage('Scan button clicked.')
  if not isAuctionHouseVisible() then
    setStatus('Open the Auction House first.')
    printMessage('Auction House is not detected as open.')
    return
  end

  local auctionApi = C_AuctionHouse
  local isReplicateApi = auctionApi and type(auctionApi.ReplicateItems) == 'function'
  if isReplicateApi then
    local lastRequest = tonumber(AzerothFlipScannerDB.lastReplicationRequestAt) or 0
    local remaining = REPLICATE_COOLDOWN_SECONDS - (time() - lastRequest)
    if remaining > 0 then
      local minutes = math.ceil(remaining / 60)
      setStatus(string.format('Full AH scans are account-throttled. Try again in about %d minute(s).', minutes))
      printMessage(string.format('Full scan cooldown: about %d minute(s) remaining.', minutes))
      return
    end

    addon.isScanning = true
    addon.startButton:Disable()
    setStatus('Requesting a full Auction House replication. This may take a few seconds...')
    local ok, errorMessage = pcall(auctionApi.ReplicateItems)
    if ok then
      AzerothFlipScannerDB.lastReplicationRequestAt = time()
      printMessage('Full Auction House replication requested; waiting for results.')
      C_Timer.After(45, function()
        if not addon.isScanning then
          return
        end

        local replicatedCount = 0
        if C_AuctionHouse and type(C_AuctionHouse.GetNumReplicateItems) == 'function' then
          replicatedCount = tonumber(C_AuctionHouse.GetNumReplicateItems()) or 0
        end

        if replicatedCount > 0 then
          printMessage(string.format(
            'No completion event arrived, but %d replicated auctions are available; saving them now.',
            replicatedCount
          ))
          onAuctionResults()
        else
          addon.isScanning = false
          if addon.startButton then
            addon.startButton:Enable()
          end
          setStatus('The client returned no replicated auctions. Check chat; a new full request may require waiting for cooldown.')
          printMessage('Timed out waiting for replicated auctions; the client has not returned a result list.')
        end
      end)
    else
      addon.isScanning = false
      addon.startButton:Enable()
      setStatus('Full Auction House replication request failed.')
      printMessage('ReplicateItems failed: ' .. tostring(errorMessage))
    end
    return
  end

  if type(CanSendAuctionQuery) ~= 'function' or type(QueryAuctionItems) ~= 'function' then
    setStatus('This client has no supported Auction House scan API.')
    printMessage('Neither C_AuctionHouse.ReplicateItems nor the legacy auction query API is available.')
    return
  end

  local canQuery, canQueryAll = CanSendAuctionQuery()
  if not canQueryAll then
    setStatus('A full scan is rate-limited. Try again when the client allows it.')
    printMessage('A full scan is rate-limited. Wait and try again.')
    return
  end

  addon.isScanning = true
  addon.startButton:Disable()
  setStatus('Requesting a full Auction House scan. This can take a while...')
  local ok, errorMessage = pcall(QueryAuctionItems, '', nil, nil, 0, false, nil, true)
  if not ok then
    addon.isScanning = false
    addon.startButton:Enable()
    setStatus('Scan request failed. Check that the AH is open, then retry.')
    printMessage(tostring(errorMessage))
  end
end

local function createWindow()
  local frame = CreateFrame('Frame', 'AzerothFlipScannerWindow', UIParent)
  frame:SetSize(390, 190)
  frame:SetPoint('CENTER')
  frame:SetFrameStrata('DIALOG')
  frame:SetMovable(true)
  frame:EnableMouse(true)
  frame:RegisterForDrag('LeftButton')
  frame:SetScript('OnDragStart', frame.StartMoving)
  frame:SetScript('OnDragStop', frame.StopMovingOrSizing)
  if frame.SetBackdrop then
    frame:SetBackdrop({
      bgFile = 'Interface/Tooltips/UI-Tooltip-Background',
      edgeFile = 'Interface/Tooltips/UI-Tooltip-Border',
      tile = true,
      tileSize = 16,
      edgeSize = 16,
      insets = { left = 4, right = 4, top = 4, bottom = 4 },
    })
    if frame.SetBackdropColor then
      frame:SetBackdropColor(0.04, 0.06, 0.08, 0.96)
    end
  end

  local title = frame:CreateFontString(nil, 'OVERLAY', 'GameFontNormalLarge')
  title:SetPoint('TOPLEFT', 18, -16)
  title:SetText('Azeroth Flip Scanner')

  local closeButton = CreateFrame('Button', nil, frame, 'UIPanelCloseButton')
  closeButton:SetPoint('TOPRIGHT', -4, -4)
  closeButton:SetScript('OnClick', function()
    frame:Hide()
  end)

  addon.statusText = frame:CreateFontString(nil, 'OVERLAY', 'GameFontHighlightSmall')
  addon.statusText:SetPoint('TOPLEFT', 20, -52)
  addon.statusText:SetPoint('RIGHT', -20, 0)
  addon.statusText:SetJustifyH('LEFT')
  addon.statusText:SetHeight(48)

  addon.regionText = frame:CreateFontString(nil, 'OVERLAY', 'GameFontHighlight')
  addon.regionText:SetPoint('BOTTOMLEFT', 20, 26)
  addon.regionText:SetText('Auction region: US')

  addon.startButton = CreateFrame('Button', nil, frame, 'UIPanelButtonTemplate')
  addon.startButton:SetSize(190, 28)
  addon.startButton:SetPoint('BOTTOMRIGHT', -18, 18)
  addon.startButton:SetText('Scan Full Auction House')
  addon.startButton:RegisterForClicks('LeftButtonUp')
  addon.startButton:SetScript('OnClick', startScan)

  addon.window = frame

  local lastScan = AzerothFlipScannerDB.scans[#AzerothFlipScannerDB.scans]
  if lastScan then
    setStatus(string.format(
      'Saved scans: %d. Latest: %d item IDs from %s.',
      #AzerothFlipScannerDB.scans,
      lastScan.itemCount or 0,
      lastScan.realm or 'unknown realm'
    ))
  else
    setStatus('Open the Auction House, choose a region, then start a full scan.')
  end
end

local function initializeScanner()
  if addon.window then
    return true
  end
  addon.initializationAttempted = true
  printMessage('Initializing scanner window.')
  local ok, errorMessage = pcall(function()
    ensureDatabase()
    createWindow()
    addon.window:Hide()
  end)
  if not ok then
    addon.initializationAttempted = false
    printMessage('Startup failed: ' .. tostring(errorMessage))
    return false
  end
  printMessage('Loaded successfully. Type /afscan to open the scanner.')
  return true
end

local function toggleWindow()
  if not addon.window then
    initializeScanner()
    if not addon.window then
      printMessage('Scanner window could not be created. Check for a Startup failed message above.')
      return
    end
  end
  if addon.window:IsShown() then
    addon.window:Hide()
    printMessage('Scanner window closed.')
  else
    addon.window:Show()
    printMessage('Scanner window opened. Open the Auction House to scan.')
  end
end

local function collectCurrentReplication()
  local auctionApi = C_AuctionHouse
  if not auctionApi or type(auctionApi.GetNumReplicateItems) ~= 'function' then
    printMessage('This client does not expose replicated Auction House results.')
    return
  end

  local replicatedCount = tonumber(auctionApi.GetNumReplicateItems()) or 0
  if replicatedCount < 1 then
    printMessage('The client has no replicated Auction House results to save yet.')
    return
  end

  if not addon.window and not initializeScanner() then
    return
  end
  addon.isScanning = true
  addon.startButton:Disable()
  printMessage(string.format('Collecting %d replicated Auction House listings.', replicatedCount))
  onAuctionResults()
end

SLASH_AZEROTHFLIPSCANNER1 = '/afscan'
SlashCmdList.AZEROTHFLIPSCANNER = function(message)
  if type(message) == 'string' and message:lower():match('^%s*collect%s*$') then
    collectCurrentReplication()
  else
    toggleWindow()
  end
end

local eventFrame = CreateFrame('Frame')
eventFrame:RegisterEvent('ADDON_LOADED')
eventFrame:RegisterEvent('PLAYER_LOGIN')
eventFrame:RegisterEvent('AUCTION_HOUSE_SHOW')
eventFrame:RegisterEvent('AUCTION_HOUSE_CLOSED')
eventFrame:RegisterEvent('AUCTION_ITEM_LIST_UPDATE')
if C_AuctionHouse and type(C_AuctionHouse.ReplicateItems) == 'function' then
  eventFrame:RegisterEvent('REPLICATE_ITEM_LIST_UPDATE')
end
eventFrame:SetScript('OnEvent', function(_, event, loadedAddonName)
  if event == 'ADDON_LOADED' and loadedAddonName == ADDON_NAME then
    initializeScanner()
  elseif event == 'PLAYER_LOGIN' then
    initializeScanner()
  elseif event == 'AUCTION_HOUSE_SHOW' then
    addon.auctionHouseOpen = true
    if addon.startButton and not addon.isScanning then
      addon.startButton:Enable()
    end
  elseif event == 'AUCTION_HOUSE_CLOSED' then
    addon.auctionHouseOpen = false
  elseif event == 'AUCTION_ITEM_LIST_UPDATE' then
    onAuctionResults()
  elseif event == 'REPLICATE_ITEM_LIST_UPDATE' then
    onAuctionResults()
  end
end)