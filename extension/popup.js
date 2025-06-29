document.addEventListener('DOMContentLoaded', async () => {
  const pageTitle = document.getElementById('pageTitle');
  const pageUrl = document.getElementById('pageUrl');
  const tagsInput = document.getElementById('tags');
  const notesInput = document.getElementById('notes');
  const saveBtn = document.getElementById('saveBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const saveForm = document.getElementById('saveForm');

  let currentPageData = null;

  // Get current tab data
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Extract page data
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: extractPageData
    });
    
    currentPageData = result.result;
    
    // Populate page info
    pageTitle.textContent = currentPageData.title;
    pageUrl.textContent = currentPageData.url;
    
  } catch (error) {
    console.error('Error getting page data:', error);
    showStatus('Error loading page data', 'error');
  }

  // Handle form submission
  saveForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentPageData) {
      showStatus('No page data available', 'error');
      return;
    }
    
    const tags = tagsInput.value.trim();
    const notes = notesInput.value.trim();
    
    // Prepare article data with user inputs
    const articleData = {
      ...currentPageData,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      notes: notes
    };
    
    try {
      showStatus('Saving article...', 'loading');
      saveBtn.disabled = true;
      
      // Send to background script and wait for response
      const response = await chrome.runtime.sendMessage({
        action: 'saveArticle',  
        data: articleData
      });
      
      if (response && response.success) {
        showStatus('Article saved successfully!', 'success');
        
        // Close popup after short delay
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        const errorMsg = response?.error || 'Unknown error occurred';
        console.error('Save failed:', errorMsg);
        showStatus(`Failed to save: ${errorMsg}`, 'error');
        saveBtn.disabled = false;
      }
      
    } catch (error) {
      console.error('Error saving article:', error);
      showStatus('Failed to save article', 'error');
      saveBtn.disabled = false;
    }
  });

  // Handle cancel
  cancelBtn.addEventListener('click', () => {
    window.close();
  });

  // Focus on tags input
  tagsInput.focus();
});

function extractPageData() {
  const url = window.location.href;
  const title = document.title || url;
  
  let description = '';
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    description = metaDesc.content;
  }
  
  let featuredImage = '';
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) {
    featuredImage = ogImage.content;
  }
  
  return {
    url,
    title,
    description,
    featuredImage,
    timestamp: new Date().toISOString(),
    domain: new URL(url).hostname
  };
}

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  status.classList.remove('hidden');
  
  if (type === 'success' || type === 'error') {
    setTimeout(() => {
      status.classList.add('hidden');
    }, 3000);
  }
}