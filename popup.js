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
      backItem.className = 'folder-item';
      backItem.innerHTML = `
        <div class="item-title">
          <span>⬅️ Back to ${folderPath[folderPath.length - 2].title}</span>
        </div>
      `;
      backItem.addEventListener('click', () => {
        const parentId = folderPath[folderPath.length - 2].id;
        folderPath.pop();
        currentFolder = parentId;
        loadBookmarks(parentId);
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
  
  bookmarkItem.innerHTML = `
    <div class="item-title">
      <span class="bookmark-icon">🔖</span>
      <span>${bookmark.title || bookmark.url}</span>
    </div>
    <div class="item-actions">
      <button class="edit-btn" title="Edit">✏️</button>
      <button class="delete-btn" title="Delete">🗑️</button>
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
      <span class="folder-icon">📁</span>
      <span>${folder.title}</span>
    </div>
    <div class="item-actions">
      <button class="edit-btn" title="Edit">✏️</button>
      <button class="delete-btn" title="Delete">🗑️</button>
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
    backItem.className = 'folder-item';
    backItem.innerHTML = `
      <div class="item-title">
        <span>⬅️ Back to folder view</span>
      </div>
    `;
    backItem.addEventListener('click', () => {
      searchInput.value = '';
      loadBookmarks(currentFolder);
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
  const dropTargets = document.querySelectorAll('.folder-item');
  
  draggableItems.forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedItem = {
        id: item.dataset.id,
        type: item.dataset.type
      };
      item.style.opacity = '0.5';
    });
    
    item.addEventListener('dragend', () => {
      item.style.opacity = '1';
      document.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
      });
    });
  });
  
  dropTargets.forEach(target => {
    target.addEventListener('dragover', (e) => {
      e.preventDefault();
      target.classList.add('drag-over');
    });
    
    target.addEventListener('dragleave', () => {
      target.classList.remove('drag-over');
    });
    
    target.addEventListener('drop', (e) => {
      e.preventDefault();
      target.classList.remove('drag-over');
      
      if (draggedItem && draggedItem.id !== target.dataset.id) {
        // Move the dragged item to this folder
        chrome.bookmarks.move(draggedItem.id, {
          parentId: target.dataset.id
        }, () => {
          loadBookmarks(currentFolder);
        });
      }
    });
  });
  
  // Allow dropping in the main container to move items to the current folder
  bookmarksContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  
  bookmarksContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    
    // Only process if the drop happened directly on the container (not on a folder)
    if (e.target === bookmarksContainer) {
      if (draggedItem) {
        // Move the dragged item to the current folder
        chrome.bookmarks.move(draggedItem.id, {
          parentId: currentFolder
        }, () => {
          loadBookmarks(currentFolder);
        });
      }
    }
  });
}

// Close the modals when clicking outside of them
window.addEventListener('click', (e) => {
  if (e.target === bookmarkModal) {
    bookmarkModal.style.display = 'none';
  } else if (e.target === folderModal) {
    folderModal.style.display = 'none';
  }
});