// Swap Type Plugin for Power Eagle
// Move items between folders and tags by double-clicking folder tags

// This is the main plugin function that gets called with the context
async function plugin(context) {
  const { eagle, powersdk } = context;
  
  console.log('Swap Type plugin loaded');

  // Plugin state
  let selectedItems = [];
  let commonFolders = [];
  let commonTags = [];
  let isRefreshing = false;

  // Initialize the plugin UI
  await initializeUI();

  async function initializeUI() {
    // Create the plugin interface
    powersdk.container.innerHTML = `
      <div class="swap-type-container max-w-4xl mx-auto p-6">
        <div class="header mb-6">
          <h1 class="text-2xl font-bold mb-2">Swap Type Tool</h1>
          <p class="text-gray-600">Move items between folders and tags</p>
        </div>
        
        <!-- Selection Info -->
        <div class="flex items-center justify-between bg-base-200 rounded-lg p-4 mb-6">
          <div class="flex items-center gap-3">
            <span class="text-lg font-semibold">Selected Items:</span>
            <div class="badge badge-primary badge-lg" id="item-count">0</div>
          </div>
          <div id="loading-indicator" class="loading loading-spinner loading-sm hidden"></div>
        </div>

        <!-- Common Folders Section -->
        <div class="card bg-base-100 shadow-xl mb-6">
          <div class="card-body">
            <h2 class="card-title mb-4">
              📁 Common Folders
              <div class="badge badge-secondary">Double-click to convert to tag</div>
            </h2>
            <div id="folders-container" class="flex flex-wrap gap-2 min-h-[60px] border-2 border-dashed border-gray-300 p-4 rounded-lg">
              <p class="text-gray-500 text-center w-full">No common folders found</p>
            </div>
          </div>
        </div>

        <!-- Common Tags Section -->
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <h2 class="card-title mb-4">
              🏷️ Common Tags
              <div class="badge badge-secondary">Double-click to convert to folder</div>
            </h2>
            <div id="tags-container" class="flex flex-wrap gap-2 min-h-[80px] border-2 border-dashed border-blue-300 p-4 rounded-lg bg-blue-50">
              <p class="text-gray-500 text-center w-full">No common tags found</p>
            </div>
          </div>
        </div>

        <!-- Instructions -->
        <div class="alert alert-info mt-6">
          <svg class="w-6 h-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <h3 class="font-bold">How to use:</h3>
            <p>1. Select multiple items in Eagle</p>
            <p>2. Double-click a folder badge to move items from folder → tag</p>
            <p>3. Double-click a tag badge to move items from tag → folder</p>
            <p>4. Items will be organized and folders/tags will be created as needed</p>
          </div>
        </div>
      </div>
    `;
    
    // Load initial data
    await refreshData();
    
    // Set up Eagle state change listeners instead of polling
    await setupStateListeners();
  }

  async function setupStateListeners() {
    try {
      console.log('Setting up Eagle state listeners');
      
      // Only register callback for item selection changes
      powersdk.listeners.registerCallback('itemChange', (selectedItemIds) => {
        console.log('Item selection change detected, refreshing immediately');
        refreshData();
      });
      
      // Start monitoring only item changes with 2 second polling
      await powersdk.listeners.startItemMonitoring(2000);
      console.log('Eagle item state listeners started successfully');
      
    } catch (error) {
      console.error('Error setting up state listeners:', error);
      // Fallback to interval polling if listeners fail
      console.log('Falling back to interval polling');
      setInterval(() => refreshData(), 5000);
    }
  }

  async function refreshData() {
    // Prevent overlapping refresh operations
    if (isRefreshing) {
      console.log('Refresh already in progress, skipping');
      return;
    }
    
    try {
      isRefreshing = true;
      
      // Show loading indicator
      const loadingIndicator = powersdk.container.querySelector('#loading-indicator');
      if (loadingIndicator) {
        loadingIndicator.classList.remove('hidden');
      }
      // Get currently selected items
      const selection = await eagle.item.getSelected();
      const newSelectedItems = selection || [];
      
      console.log('Current selection count:', newSelectedItems.length);
      console.log('Previous selection count:', selectedItems.length);
      
      // Check if selection actually changed
      const oldIds = selectedItems.map(item => item.id).sort();
      const newIds = newSelectedItems.map(item => item.id).sort();
      const selectionChanged = !arraysEqual(oldIds, newIds);
      
      console.log('Old IDs:', oldIds);
      console.log('New IDs:', newIds);
      console.log('Selection changed:', selectionChanged);
      
      if (!selectionChanged) {
        console.log('No selection changes detected, skipping refresh');
        return;
      }
      
      selectedItems = newSelectedItems;
      
      // Update item count
      const itemCountElement = powersdk.container.querySelector('#item-count');
      if (itemCountElement) {
        itemCountElement.textContent = selectedItems.length;
      }

      if (selectedItems.length === 0) {
        displayNoSelection();
        return;
      }

      // Store previous state for comparison
      const previousFolders = [...commonFolders];
      const previousTags = [...commonTags];

      // Find common folders and tags
      await findCommonFoldersAndTags();
      
      // Only update UI if there are actual changes
      const previousFolderIds = previousFolders.map(f => f.id || f).sort();
      const currentFolderIds = commonFolders.map(f => f.id || f).sort();
      const foldersChanged = !arraysEqual(previousFolderIds, currentFolderIds);
      
      const previousTagsSorted = [...previousTags].sort();
      const currentTagsSorted = [...commonTags].sort();
      const tagsChanged = !arraysEqual(previousTagsSorted, currentTagsSorted);
      
      console.log('Previous folders:', previousFolderIds);
      console.log('Current folders:', currentFolderIds);
      console.log('Folders changed:', foldersChanged);
      console.log('Previous tags:', previousTagsSorted);
      console.log('Current tags:', currentTagsSorted);
      console.log('Tags changed:', tagsChanged);
      
      if (foldersChanged) {
        console.log('Folders changed, updating display');
        displayFolders();
      }
      
      if (tagsChanged) {
        console.log('Tags changed, updating display');
        displayTags();
      }
      
      if (!foldersChanged && !tagsChanged) {
        console.log('No folder/tag changes detected, UI unchanged');
      }
      
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      // Always reset the refreshing flag and hide loading indicator
      isRefreshing = false;
      const loadingIndicator = powersdk.container.querySelector('#loading-indicator');
      if (loadingIndicator) {
        loadingIndicator.classList.add('hidden');
      }
    }
  }

  function arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((val, index) => val === arr2[index]);
  }

  async function findCommonFoldersAndTags() {
    if (selectedItems.length === 0) {
      commonFolders = [];
      commonTags = [];
      return;
    }
    
    // Get all folders and tags from all selected items
    const allFolders = selectedItems.map(item => item.folders || []);
    const allTags = selectedItems.map(item => item.tags || []);

    console.log('Debug - All folders from items:', allFolders);
    console.log('Debug - Sample item structure:', selectedItems[0]);

    // Find folder IDs that appear in ALL selected items
    if (allFolders.length > 0) {
      const commonFolderIds = allFolders[0].filter(folderId => 
        allFolders.every(itemFolders => 
          itemFolders.includes(folderId)
        )
      );
      
      console.log('Debug - Common folder IDs:', commonFolderIds);
      
      // Get actual folder objects using the IDs
      if (commonFolderIds.length > 0) {
        try {
          console.log('Debug - Calling eagle.folder.getByIds with:', commonFolderIds);
          commonFolders = await eagle.folder.getByIds(commonFolderIds);
          console.log('Debug - Response from eagle.folder.getByIds:', commonFolders);
        } catch (error) {
          console.error('Error getting folder objects:', error);
          // If API fails, create mock objects from IDs
          commonFolders = commonFolderIds.map(id => ({ id, name: `Folder ${id}` }));
        }
      } else {
        commonFolders = [];
      }
    } else {
      commonFolders = [];
    }

    // Find tags that appear in ALL selected items  
    if (allTags.length > 0) {
      commonTags = allTags[0].filter(tag => 
        allTags.every(itemTags => 
          itemTags.includes(tag)
        )
      );
    } else {
      commonTags = [];
    }
  }

  function displayNoSelection() {
    const foldersContainer = powersdk.container.querySelector('#folders-container');
    const tagsContainer = powersdk.container.querySelector('#tags-container');
    
    if (foldersContainer) {
      foldersContainer.innerHTML = '<p class="text-gray-500 text-center w-full">Select items in Eagle to see common folders</p>';
    }
    
    if (tagsContainer) {
      tagsContainer.innerHTML = '<p class="text-gray-500 text-center w-full">Select items in Eagle to see common tags</p>';
    }
  }

  function displayFolders() {
    const container = powersdk.container.querySelector('#folders-container');
    if (!container) return;

    if (commonFolders.length === 0) {
      container.innerHTML = '<p class="text-gray-500 text-center w-full">No folders common to all selected items</p>';
      return;
    }

    // Create clickable folder tags
    const folderElements = commonFolders.map((folder, index) => {
      console.log('Folder object:', folder); // Debug log
      const folderName = folder.name || folder.title || folder.id || 'Unknown Folder';
      return `
        <div class="badge badge-outline badge-lg cursor-pointer hover:badge-primary transition-colors whitespace-nowrap" 
             id="folder-${index}"
             title="Double-click to move items from this folder and add '${escapeHtml(folderName)}' as a tag">
          📁 ${escapeHtml(folderName)}
        </div>
      `;
    }).join('');

    container.innerHTML = folderElements;

    // Add double-click event listeners to folder elements
    commonFolders.forEach((folder, index) => {
      const element = powersdk.container.querySelector(`#folder-${index}`);
      if (element) {
        element.addEventListener('dblclick', () => {
          swapFolderToTag(folder);
        });
      }
    });
  }

  function displayTags() {
    const container = powersdk.container.querySelector('#tags-container');
    if (!container) return;

    if (commonTags.length === 0) {
      container.innerHTML = '<p class="text-gray-500 text-center w-full">No tags common to all selected items</p>';
      return;
    }

    // Create clickable tag elements
    const tagElements = commonTags.map((tag, index) => {
      return `
        <div class="badge badge-primary badge-lg cursor-pointer hover:badge-secondary transition-colors whitespace-nowrap" 
             id="tag-${index}"
             title="Double-click to remove this tag and move items to folder '${escapeHtml(tag)}'">
          🏷️ ${escapeHtml(tag)}
        </div>
      `;
    }).join('');
    
    container.innerHTML = tagElements;

    // Add double-click event listeners to tag elements
    commonTags.forEach((tag, index) => {
      const element = powersdk.container.querySelector(`#tag-${index}`);
      if (element) {
        element.addEventListener('dblclick', () => {
          swapTagToFolder(tag);
        });
      }
    });
  }

  async function swapTagToFolder(tagName) {
    if (!tagName) return;
    
    try {
      // Show loading state
      const foldersContainer = powersdk.container.querySelector('#folders-container');
      if (foldersContainer) {
        foldersContainer.innerHTML = '<div class="loading loading-spinner loading-lg mx-auto"></div><p class="text-center">Processing swap...</p>';
      }

      // Use the utility function from powersdk
      const result = await powersdk.utils.op.swapTagToFolder(tagName, selectedItems, eagle);

      // Show result dialog
      if (result.success) {
        alert(`Swap Complete: Successfully moved ${result.processedCount} items to folder "${tagName}" and removed "${tagName}" tag.`);
      } else {
        alert(`Swap Completed with Errors: Processed ${result.processedCount} items successfully, but encountered ${result.errors.length} errors:\n\n${result.errors.slice(0, 3).join('\n')}${result.errors.length > 3 ? '\n...' : ''}`);
      }

      // Immediately refresh the display to show updated state
      await refreshData();

    } catch (error) {
      console.error('Error in swapTagToFolder:', error);
      alert(`Swap Failed: Failed to swap tag to folder: ${error.message}`);
    }
  }

  async function swapFolderToTag(folder) {
    if (!folder) return;
    
    try {
      // Show loading state
      const tagsContainer = powersdk.container.querySelector('#tags-container');
      if (tagsContainer) {
        tagsContainer.innerHTML = '<div class="loading loading-spinner loading-lg mx-auto"></div><p class="text-center">Processing swap...</p>';
      }

      // Use the utility function from powersdk
      const result = await powersdk.utils.op.swapFolderToTag(folder, selectedItems, eagle);

      // Show result dialog
      if (result.success) {
        alert(`Swap Complete: Successfully moved ${result.processedCount} items from folder "${folder.name}" and added "${folder.name}" as a tag.`);
      } else {
        alert(`Swap Completed with Errors: Processed ${result.processedCount} items successfully, but encountered ${result.errors.length} errors:\n\n${result.errors.slice(0, 3).join('\n')}${result.errors.length > 3 ? '\n...' : ''}`);
      }

      // Immediately refresh the display to show updated state
      await refreshData();

    } catch (error) {
      console.error('Error in swapFolderToTag:', error);
      alert(`Swap Failed: Failed to swap folder to tag: ${error.message}`);
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Execute the plugin function immediately
plugin(context);
