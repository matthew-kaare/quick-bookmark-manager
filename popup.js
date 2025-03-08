// popup.js - Handles all the bookmark functionality

// DOM elements
const bookmarksContainer = document.getElementById('bookmarks-container');
const folderPathElement = document.getElementById('folder-path');
const searchInput = document.getElementById('search-input');
const addBookmarkBtn = document.getElementById('add-bookmark');
const addFolderBtn = document.getElementById('add-folder');
const bookmarkModal = document.getElementById('add-bookmark-modal');
const folderModal = document.getElementById('add-folder-modal');
const saveBookmarkBtn = document.getElementById('save-bookmark');
const saveFolderBtn = document.getElementById('save-folder');
const closeButtons = document.querySelectorAll('.close');

// State variables
let currentFolder = '1'; // Default is the Bookmarks Bar
let folderPath = [];
let draggedItem = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadBookmarks(currentFolder);
  setupEventListeners();
});

// Set up all event listeners
function setupEventListeners() {
  // Modal close buttons
  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      bookmarkModal.style.display = 'none';
      folderModal.style.display = 'none';
    });
  });

  // Open modals
  addBookmarkBtn.addEventListener('click', () => {
    // Get current tab URL to prefill the form
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      document.getElementById('bookmark-url').value = tabs[0].url;
      document.getElementById('bookmark-title').value = tabs[0].title;
      bookmarkModal.style.display = 'block';
    });
  });

  addFolderBtn.addEventListener('click', () => {
    folderModal.style.display = 'block';
  });

  // Save new bookmark
  saveBookmarkBtn.addEventListener('click', () => {
    const title = document.getElementById('bookmark-title').value;
    const url = document.getElementById('bookmark-url').value;
    
    if (title && url) {
      chrome.bookmarks.create({
        'parentId': currentFolder,
        'title': title,
        'url': url
      }, () => {
        bookmarkModal.style.display = 'none';
        loadBookmarks(currentFolder);
      });
    }
  });

  // Save new folder
  saveFolderBtn.addEventListener('click', () => {
    const folderName = document.getElementById('folder-name').value;
    
    if (folderName) {
      chrome.bookmarks.create({
        'parentId': currentFolder,
        'title': folderName
      }, () => {
        folderModal.style.display = 'none';
        loadBookmarks(currentFolder);
      });
    }
  });

  // Search functionality
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    if (query.length > 0) {
      searchBookmarks(query);
    } else {
      loadBookmarks(currentFolder);
    }
  });
}

// Load bookmarks for the specified folder
function loadBookmarks(folderId) {
  chrome.bookmarks.getSubTree(folderId, (results) => {
    const folder = results[0];
    updateFolderPath(folder);
    
    // Clear the container
    bookmarksContainer.innerHTML = '';
    
    // If we're not at the root, add a "Go back" option
    if (folderPath.length > 1) {
      const backItem = document.createElement('div');
      backItem.className = 'bookmark-item';
      backItem.innerHTML = `
        <div class="item-title">
          <span>${folderPath[folderPath.length - 2].title}</span>
        </div>
        <div class="item-actions">
          <button class="back-btn" title="Go back">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            Back
          </button>
        </div>
      `;
      
      const backBtn = backItem.querySelector('.back-btn');
      backBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const parentId = folderPath[folderPath.length - 2].id;
        folderPath.pop();
        currentFolder = parentId;
        loadBookmarks(parentId);
      });
      
      backItem.addEventListener('click', (e) => {
        if (!e.target.closest('.item-actions')) {
          const parentId = folderPath[folderPath.length - 2].id;
          folderPath.pop();
          currentFolder = parentId;
          loadBookmarks(parentId);
        }
      });
      
      bookmarksContainer.appendChild(backItem);
    }
    
    // Add all children (bookmarks and folders)
    if (folder.children) {
      folder.children.forEach(child => {
        if (child.url) {
          // This is a bookmark
          addBookmarkElement(child);
        } else {
          // This is a folder
          addFolderElement(child);
        }
      });
    }
    
    // Set up drag and drop
    setupDragAndDrop();
  });
}

// Add a bookmark element to the container
function addBookmarkElement(bookmark) {
  const bookmarkItem = document.createElement('div');
  bookmarkItem.className = 'bookmark-item';
  bookmarkItem.draggable = true;
  bookmarkItem.dataset.id = bookmark.id;
  bookmarkItem.dataset.type = 'bookmark';
  
  // Get the favicon URL from the bookmark URL
  const url = new URL(bookmark.url);
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=16`;
  
  bookmarkItem.innerHTML = `
    <div class="item-title">
      <img class="favicon" src="${faviconUrl}" alt="" loading="lazy">
      <span class="bookmark-icon" style="display: none;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
        </svg>
      </span>
      <span>${bookmark.title || bookmark.url}</span>
    </div>
    <div class="item-actions">
      <button class="edit-btn" title="Edit">Edit</button>
      <button class="delete-btn" title="Delete">Delete</button>
    </div>
  `;
  
  // Launch the bookmark when clicked
  bookmarkItem.addEventListener('click', (e) => {
    if (!e.target.closest('.item-actions')) {
      chrome.tabs.create({ url: bookmark.url });
    }
  });
  
  // Set up edit functionality
  bookmarkItem.querySelector('.edit-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('bookmark-title').value = bookmark.title;
    document.getElementById('bookmark-url').value = bookmark.url;
    bookmarkModal.style.display = 'block';
    
    // Update the save button to update instead of create
    saveBookmarkBtn.textContent = 'Update';
    saveBookmarkBtn.onclick = () => {
      const newTitle = document.getElementById('bookmark-title').value;
      const newUrl = document.getElementById('bookmark-url').value;
      
      chrome.bookmarks.update(bookmark.id, {
        title: newTitle,
        url: newUrl
      }, () => {
        bookmarkModal.style.display = 'none';
        saveBookmarkBtn.textContent = 'Save';
        // Reset onclick to original
        saveBookmarkBtn.onclick = null;
        loadBookmarks(currentFolder);
      });
    };
  });
  
  // Set up delete functionality
  bookmarkItem.querySelector('.delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${bookmark.title}"?`)) {
      chrome.bookmarks.remove(bookmark.id, () => {
        loadBookmarks(currentFolder);
      });
    }
  });

  // Handle favicon error
  const favicon = bookmarkItem.querySelector('.favicon');
  favicon.onerror = () => {
    favicon.style.display = 'none';
    bookmarkItem.querySelector('.bookmark-icon').style.display = 'flex';
  };

  // Handle favicon load
  favicon.onload = () => {
    favicon.style.display = 'inline-block';
    bookmarkItem.querySelector('.bookmark-icon').style.display = 'none';
  };
  
  bookmarksContainer.appendChild(bookmarkItem);
}

// Add a folder element to the container
function addFolderElement(folder) {
  const folderItem = document.createElement('div');
  folderItem.className = 'folder-item';
  folderItem.draggable = true;
  folderItem.dataset.id = folder.id;
  folderItem.dataset.type = 'folder';
  
  folderItem.innerHTML = `
    <div class="item-title">
      <span class="folder-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
        </svg>
      </span>
      <span>${folder.title}</span>
    </div>
    <div class="item-actions">
      <button class="edit-btn" title="Edit">Edit</button>
      <button class="delete-btn" title="Delete">Delete</button>
    </div>
  `;
  
  // Navigate into the folder when clicked
  folderItem.addEventListener('click', (e) => {
    if (!e.target.closest('.item-actions')) {
      currentFolder = folder.id;
      loadBookmarks(folder.id);
    }
  });
  
  // Set up edit functionality
  folderItem.querySelector('.edit-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('folder-name').value = folder.title;
    folderModal.style.display = 'block';
    
    // Update the save button to update instead of create
    saveFolderBtn.textContent = 'Update';
    saveFolderBtn.onclick = () => {
      const newName = document.getElementById('folder-name').value;
      
      chrome.bookmarks.update(folder.id, {
        title: newName
      }, () => {
        folderModal.style.display = 'none';
        saveFolderBtn.textContent = 'Save';
        // Reset onclick to original
        saveFolderBtn.onclick = null;
        loadBookmarks(currentFolder);
      });
    };
  });
  
  // Set up delete functionality
  folderItem.querySelector('.delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete the folder "${folder.title}" and all its contents?`)) {
      chrome.bookmarks.removeTree(folder.id, () => {
        loadBookmarks(currentFolder);
      });
    }
  });
  
  bookmarksContainer.appendChild(folderItem);
}

// Update the folder path display
function updateFolderPath(folder) {
  // Update the folder path array
  if (folderPath.length === 0 || folderPath[folderPath.length - 1].id !== folder.id) {
    // If this is a new folder, add it to the path
    folderPath.push({ id: folder.id, title: folder.title });
  }
  
  // Update the folder path display
  folderPathElement.innerHTML = folderPath.map(f => f.title).join(' > ');
}

// Search for bookmarks
function searchBookmarks(query) {
  chrome.bookmarks.search(query, (results) => {
    bookmarksContainer.innerHTML = '';
    
    if (results.length === 0) {
      bookmarksContainer.innerHTML = '<div class="no-results">No bookmarks found</div>';
      return;
    }
    
    // Add a back button to return to the current folder
    const backItem = document.createElement('div');
    backItem.className = 'bookmark-item';
    backItem.innerHTML = `
      <div class="item-title">
        <span>Current folder</span>
      </div>
      <div class="item-actions">
        <button class="back-btn" title="Return to folder view">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
          Back to folder
        </button>
      </div>
    `;

    const backBtn = backItem.querySelector('.back-btn');
    backBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      searchInput.value = '';
      loadBookmarks(currentFolder);
    });
    
    backItem.addEventListener('click', (e) => {
      if (!e.target.closest('.item-actions')) {
        searchInput.value = '';
        loadBookmarks(currentFolder);
      }
    });
    
    bookmarksContainer.appendChild(backItem);
    
    // Display search results
    results.forEach(item => {
      if (item.url) {
        addBookmarkElement(item);
      }
    });
  });
}

// Set up drag and drop functionality
function setupDragAndDrop() {
  const draggableItems = document.querySelectorAll('.bookmark-item, .folder-item');
  const dropTargets = document.querySelectorAll('.bookmark-item, .folder-item, .bookmarks-container');
  let draggedElement = null;
  let dropTarget = null;
  let dropPosition = 'before'; // 'before', 'after', or 'inside'

  draggableItems.forEach(item => {
    // Don't allow dragging the back button
    if (item.querySelector('.back-btn')) {
      item.draggable = false;
      return;
    }

    item.addEventListener('dragstart', (e) => {
      draggedElement = item;
      e.dataTransfer.effectAllowed = 'move';
      item.classList.add('dragging');
    });

    item.addEventListener('dragend', () => {
      draggedElement.classList.remove('dragging');
      dropTargets.forEach(target => target.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom'));
    });

    item.addEventListener('dragover', (e) => handleDragOver(e, item));
    item.addEventListener('dragleave', handleDragLeave);
    item.addEventListener('drop', handleDrop);
  });

  // Allow dropping in the main container
  bookmarksContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const rect = bookmarksContainer.getBoundingClientRect();
    const items = Array.from(bookmarksContainer.children);
    const lastItem = items[items.length - 1];
    
    if (lastItem && e.clientY > lastItem.getBoundingClientRect().bottom) {
      bookmarksContainer.classList.add('drag-over');
      dropTarget = bookmarksContainer;
      dropPosition = 'inside';
    }
  });

  bookmarksContainer.addEventListener('dragleave', (e) => {
    if (!e.relatedTarget?.closest('.bookmarks-container')) {
      bookmarksContainer.classList.remove('drag-over');
    }
  });

  bookmarksContainer.addEventListener('drop', handleDrop);

  function handleDragOver(e, target) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (target === draggedElement) return;

    const rect = target.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;

    dropTarget = target;
    target.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');

    if (target.classList.contains('folder-item') && e.clientY < midY + 10 && e.clientY > midY - 10) {
      target.classList.add('drag-over');
      dropPosition = 'inside';
    } else if (e.clientY < midY) {
      target.classList.add('drag-over-top');
      dropPosition = 'before';
    } else {
      target.classList.add('drag-over-bottom');
      dropPosition = 'after';
    }
  }

  function handleDragLeave(e) {
    if (!e.relatedTarget?.closest('.bookmark-item, .folder-item')) {
      e.target.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    if (!draggedElement || draggedElement === dropTarget) return;

    const draggedId = draggedElement.dataset.id;
    const draggedType = draggedElement.dataset.type;
    
    // Get the target folder ID and index
    let parentId = currentFolder;
    let index = 0;

    if (dropTarget === bookmarksContainer) {
      // Dropping at the end of the list
      const items = Array.from(bookmarksContainer.children);
      index = items.length;
    } else if (dropTarget.classList.contains('folder-item') && dropPosition === 'inside') {
      // Dropping inside a folder
      parentId = dropTarget.dataset.id;
    } else {
      // Dropping before or after an item
      const items = Array.from(bookmarksContainer.children);
      const targetIndex = items.indexOf(dropTarget);
      index = dropPosition === 'before' ? targetIndex : targetIndex + 1;
    }

    // Move the bookmark/folder
    chrome.bookmarks.move(draggedId, {
      parentId: parentId,
      index: index
    }, () => {
      loadBookmarks(currentFolder);
    });

    // Clean up
    dropTargets.forEach(target => target.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom'));
  }
}

// Close the modals when clicking outside of them
window.addEventListener('click', (e) => {
  if (e.target === bookmarkModal) {
    bookmarkModal.style.display = 'none';
  } else if (e.target === folderModal) {
    folderModal.style.display = 'none';
  }
});