const projectNameInput = document.getElementById('projectName');
const taskNameInput = document.getElementById('taskName');
const actorsNameInput = document.getElementById('actorsName');
const startButton = document.getElementById('startButton');
const runningTasksDiv = document.getElementById('runningTasks');
const errorMessageDiv = document.getElementById('errorMessage');
const noteSelector = document.getElementById('noteSelector');
let selectedNoteName = '';
const completedTasksDiv = document.getElementById('completedTasks');
const aggregationSlider = document.getElementById('aggregationSlider');
let currentAggregationLevel = 1;
const taskFilter = document.getElementById('taskFilter');
let currentFilter = '';


let tasks = {};
let completedTasks = [];
let uniqueTasks = [];
let uniqueProjects = [];
let uniqueActors = [];
let lastStartDate = '';
let lastEndDate = '';

let runningTasksInterval;

let currentSortBy = 'duration'; // Default sorting option

function requestInitialData() {
  webviewApi.postMessage({
    name: 'requestInitialData'
  });
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  const pad = (num) => num.toString().padStart(2, '0');
  
  return `${pad(hours)}:${pad(minutes)}:${pad(remainingSeconds)}`;
}

function formatStartTime(timestamp) {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function startUpdatingRunningTasks() {
  if (!runningTasksInterval) {
    runningTasksInterval = setInterval(updateRunningTasksDisplay, 1000);
  }
}

function stopUpdatingRunningTasks() {
  if (runningTasksInterval) {
    clearInterval(runningTasksInterval);
    runningTasksInterval = null;
  }
}

function updateRunningTasksDisplay() {
  const now = Date.now();
  let tasksHtml = '';
  
  try {
    tasksHtml = Object.entries(tasks).map(([key, { startTime, project }]) => {
      const [projectName, taskName, actorsName] = key.split('|');
      const durationSeconds = Math.floor((now - startTime) / 1000);
      const formattedDuration = formatDuration(durationSeconds);
      const formattedStartTime = formatStartTime(startTime);
      return `<div class="running-task">
        <div class="running-task-header">
          <div class="running-task-title-container">
          <span class="running-task-project">${projectName}</span>
            <span class="running-task-title">${taskName}</span>
            <span class="running-task-actors">${actorsName}</span>
          </div>
          <button class="stopButton" data-project="${projectName}" data-task="${taskName}" data-actors="${actorsName}">Stop</button>
        </div>
        <div class="running-task-info">
          <span class="running-task-start-time">${formattedStartTime}</span>
          <span class="running-task-duration">${formattedDuration}</span>
        </div>
      </div>`;
    }).join('');
  } catch (error) {
    console.error('Error while generating tasks HTML:', error);
    tasksHtml = 'Error displaying tasks';
  }
  
  runningTasksDiv.innerHTML = tasksHtml || 'No tasks running';

  if (Object.keys(tasks).length > 0) {
    startUpdatingRunningTasks();
  } else {
    stopUpdatingRunningTasks();
  }
}

// Add event listener for start button
startButton.addEventListener('click', function() {
  const taskName = taskNameInput.value.trim();
  const projectName = projectNameInput.value.trim();
  const actorsName = actorsNameInput.value.trim();
  if (taskName && projectName) {
    webviewApi.postMessage({
      name: 'start',
      projectName: projectName,
      taskName: taskName,
      actorsName: actorsName
    });
    projectNameInput.value = '';
    taskNameInput.value = '';
    actorsNameInput.value = '';

  } else {
    console.log('Task name or project name is empty, not sending message');
  }
});

// Use event delegation for stop buttons in runningTasksDiv
runningTasksDiv.addEventListener('click', function(event) {
  if (event.target.classList.contains('stopButton')) {
    const projectName = event.target.getAttribute('data-project');
    const taskName = event.target.getAttribute('data-task');
    const actorsName = event.target.getAttribute('data-actors');
    webviewApi.postMessage({
      name: 'stop',
      projectName: projectName,
      taskName: taskName,
      actorsName: actorsName
    });
    delete tasks[`${projectName}|${taskName}|${actorsName}`];
    updateRunningTasksDisplay();
  }
});

// Use event delegation for start buttons in completedTasksDiv
document.getElementById('completedTasks').addEventListener('click', function(event) {
  if (event.target.classList.contains('startButton')) {
    const projectName = event.target.getAttribute('data-project');
    const taskName = event.target.getAttribute('data-task');
    const actorsName = event.target.getAttribute('data-actors');
    webviewApi.postMessage({
      name: 'start',
      projectName: projectName,
      taskName: taskName,
      actorsName: actorsName
    });
  }
});

function updateNoteSelector(logNotes) {
  const previousNoteId = noteSelector.value;
  noteSelector.innerHTML = (logNotes.length > 0) ? '' : `<option value="">To start, tag a new note with a time-slip tag</option>`;
  
  const addedNoteIds = new Set();
  logNotes.forEach(note => {
    // Only add the note if we haven't seen its ID before
    if (!addedNoteIds.has(note.id)) {
      const option = document.createElement('option');
      option.value = note.id;
      option.textContent = note.title;
      noteSelector.appendChild(option);
      
      // Add the note ID to our Set
      addedNoteIds.add(note.id);
    }
  });

  if (logNotes.length > 0) {
    if (previousNoteId && logNotes.some(note => note.id === previousNoteId)) {
      noteSelector.value = previousNoteId;
    } else {
      noteSelector.value = logNotes[0].id;
      // Trigger the change event to initialize the note
      noteSelector.dispatchEvent(new Event('change'));
    }
  } else {
    noteSelector.dispatchEvent(new Event('change'));
  }
  
  updateOpenNoteButtonVisibility();
}

function updateOpenNoteButtonVisibility() {
  const openNoteButton = document.getElementById('openNoteButton');
  if (openNoteButton) {
    openNoteButton.style.display = noteSelector.value ? 'inline-block' : 'none';
  }
}

noteSelector.addEventListener('change', function() {
  const selectedNoteId = this.value;
  selectedNoteName = this.options[this.selectedIndex].text;
  webviewApi.postMessage({
    name: 'changeNote',
    noteId: selectedNoteId,
    startDate: lastStartDate,
    endDate: lastEndDate
  });
  
  updateOpenNoteButtonVisibility();
});

// Add this new function
function openSelectedNote() {
  const selectedNoteId = noteSelector.value;
  if (selectedNoteId) {
    webviewApi.postMessage({
      name: 'openNote',
      noteId: selectedNoteId
    });
  }
}

function convertCsvToMarkdown(csv) {
  const rows = csv.trim().split('\n').map(row => row.split(';'));
  const headers = rows[0];
  const body = rows.slice(1);

  let markdown = '| ' + headers.join(' | ') + ' |\n';
  markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
  body.forEach(row => {
    markdown += '| ' + row.join(' | ') + ' |\n';
  });

  return markdown;
}

webviewApi.onMessage(function(event) {
  const message = event.message;
  if (message.name === 'updateRunningTasks') {
    tasks = message.tasks || {};
    updateRunningTasksDisplay();
    errorMessageDiv.textContent = ''; // Clear any previous error messages

  } else if (message.name === 'updateCompletedTasks') {
    completedTasks = message.tasks || [];
    updateCompletedTasksDisplay();

  } else if (message.name === 'updateAutocompleteLists') {
    uniqueProjects = message.projects || [];
    uniqueTasks = message.tasks || [];
    uniqueActors = message.actors || [];
    updateAutocompleteLists();

  } else if (message.name === 'error') {
    errorMessageDiv.textContent = message.message;
    errorMessageDiv.style.color = 'red';

  } else if (message.name === 'initialData') {
    // Handle initial data
    tasks = message.runningTasks || {};
    completedTasks = message.completedTasks || [];
    uniqueProjects = message.uniqueProjects || [];
    uniqueTasks = message.uniqueTasks || [];
    uniqueActors = message.uniqueActors || [];
    updateRunningTasksDisplay();
    updateCompletedTasksDisplay();
    updateAutocompleteLists();
    updateNoteSelector(message.logNotes);
    
    // If there's a default note ID, select it and set the selectedNoteName
    if (message.defaultNoteId && noteSelector.querySelector(`option[value="${message.defaultNoteId}"]`)) {
      noteSelector.value = message.defaultNoteId;
      selectedNoteName = noteSelector.options[noteSelector.selectedIndex].text;
      noteSelector.dispatchEvent(new Event('change'));
    }

    // Set the aggregation level
    currentAggregationLevel = message.aggregationLevel || 1;
    aggregationSlider.value = currentAggregationLevel;
    updateCompletedTasksDisplay();

    taskNameInput.focus();

    currentSortBy = message.sortBy || 'duration';
  } else if (message.name === 'updateLogNotes') {
    updateNoteSelector(message.notes);

  } else if (message.name === 'defaultDateRange') {
    const startDate = new Date(message.startDate);
    const endDate = new Date(message.endDate);

    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');

    lastStartDate = startDate.toLocaleDateString('en-CA');
    lastEndDate = endDate.toLocaleDateString('en-CA');

    startDateInput.value = lastStartDate;
    endDateInput.value = lastEndDate;

    // Trigger initial filter
    applyDateFilter(startDateInput, endDateInput);

  } else if (message.name === 'updateSortOrder') {
    currentSortBy = message.sortBy;
    updateCompletedTasksDisplay();

  } else if (message.name === 'requestSummaryCSV') {
    const csvContent = completedTasksDiv.getAttribute('data-csv-content');
    webviewApi.postMessage({
      name: 'summaryCSV',
      content: csvContent
    });

  } else if (message.name === 'requestSummaryMarkdown') {
    const csvContent = completedTasksDiv.getAttribute('data-csv-content');
    const markdownContent = convertCsvToMarkdown(csvContent);
    webviewApi.postMessage({
      name: 'summaryMarkdown',
      content: markdownContent
    });
  }
});

function aggregateTasks(tasks, level) {
  if (level === 1) {
    return tasks.map(task => ({
      name: task.taskName,
      duration: task.duration,
      endTime: task.endTime,
      originalProject: task.project,
      originalTask: task.taskName,
      originalActors: task.actors
    }));
  }

  const aggregated = tasks.reduce((acc, task) => {
    const key = level === 2 ? task.project : 'Total';
    if (!acc[key]) {
      acc[key] = { name: key, duration: 0, endTime: 0, tasks: [] };
    }
    acc[key].duration += task.duration;
    acc[key].endTime = Math.max(acc[key].endTime, task.endTime);
    acc[key].tasks.push(task);
    return acc;
  }, {});

  return Object.values(aggregated).map(item => ({
    name: item.name,
    duration: item.duration,
    endTime: item.endTime,
    originalProject: item.tasks[0].project,
    originalTask: item.tasks[0].taskName,
    originalActors: item.tasks[0].actors
  }));
}

function updateCompletedTasksDisplay() {
  const aggregationLevelDiv = document.querySelector('.aggregation-level');

  let tasksHtml = '';
  let csvContent = '';

  if (completedTasks.length > 0) {
    const filteredTasks = completedTasks.filter(task => 
      task.project.toLowerCase().includes(currentFilter.toLowerCase()) ||
      task.taskName.toLowerCase().includes(currentFilter.toLowerCase()) || 
      task.actors.toLowerCase().includes(currentFilter.toLowerCase())
    );
    let aggregatedTasks = aggregateTasks(filteredTasks, currentAggregationLevel);
    
    // Sort the aggregated tasks
    aggregatedTasks.sort((a, b) => {
      if (currentSortBy === 'duration') {
        return b.duration - a.duration;
      } else if (currentSortBy === 'endTime') {
        return b.endTime - a.endTime;
      } else if (currentSortBy === 'name') {
        const aName = currentAggregationLevel === 1 ? a.originalProject + ' ' + a.originalTask + ' ' + a.originalActors :
                      currentAggregationLevel === 2 ? a.name :
                      selectedNoteName || '';
        const bName = currentAggregationLevel === 1 ? b.originalProject + ' ' + b.originalTask + ' ' + b.originalActors :
                      currentAggregationLevel === 2 ? b.name :
                      selectedNoteName || '';
        return aName.localeCompare(bName);
      }
    });
    
    const timeTrackerWidth = document.getElementById('timeTracker').offsetWidth;
    const showBothColumns = timeTrackerWidth > 340;  // in pixels

    tasksHtml += '<table class="completed-tasks-table">';
    
    // Table header based on aggregation level
    let headerDuration = 'Duration';
    let headerTime = 'End Time';
    let headerProject = 'Project';
    let headerActors = 'Actors';
    let headerTask = 'Task';
    if (currentSortBy === 'duration') {
      headerDuration += '<span class="arrow-up"></span>';
    } else if (currentSortBy === 'endTime') {
      headerTime += '<span class="arrow-up"></span>';
    } else if (currentSortBy === 'name') {
      headerProject += '<span class="arrow-down"></span>';
      headerTask += '<span class="arrow-down"></span>';
      headerActors += '<span class="arrow-down"></span>';
    }

    if (currentAggregationLevel === 1) {
      csvContent = 'Project,Task,Duration,End date,End time\n';
      tasksHtml += `<tr>
        <th class="header-cell sortable" data-sort="name">${headerProject}</th>
        <th class="header-cell sortable" data-sort="name">${headerTask}</th>
        <th class="header-cell sortable" data-sort="name">${headerActors}</th>
        ${showBothColumns ? 
          `<th class="header-cell sortable" data-sort="duration">${headerDuration}</th>
           <th class="header-cell sortable" data-sort="endTime">${headerTime}</th>` :
          `<th class="header-cell sortable" data-sort="${currentSortBy === 'endTime' ? 'endTime' : 'duration'}">
             ${currentSortBy === 'endTime' ? headerTime : headerDuration}
           </th>`
        }
        <th class="header-cell">Action</th>
      </tr>`;
    } else if (currentAggregationLevel === 2) {
      csvContent = 'Project,Duration,End date,End time\n';
      tasksHtml += `<tr>
        <th class="header-cell sortable" data-sort="name">${headerProject}</th>
        <th class="header-cell sortable" data-sort="duration">${headerDuration}</th>
        <th class="header-cell sortable" data-sort="endTime">${headerTime}</th>
      </tr>`;
    } else {
      csvContent = 'Note,Duration,End date,End time\n';
      tasksHtml += `<tr>
        <th class="header-cell">Note</th>
        <th class="header-cell sortable" data-sort="duration">${headerDuration}</th>
        <th class="header-cell sortable" data-sort="endTime">${headerTime}</th>
      </tr>`;
    }

    aggregatedTasks.forEach(({ name, duration, originalProject, originalTask, originalActors, endTime }) => {
      const formattedDuration = formatDuration(Math.floor(duration / 1000));
      const formattedEndTime = formatDateTime(new Date(endTime));
      const csvFormattedEndTime = formattedEndTime.replace('<br>', ';');
      
      if (currentAggregationLevel === 1) {
        csvContent += `${originalProject},${originalTask},${formattedDuration},${csvFormattedEndTime}\n`;
        tasksHtml += `<tr>
          <td>${originalProject}</td>
          <td>${originalTask}</td>
          <td>${originalActors}</td>
          ${showBothColumns ?
            `<td style="word-wrap: break-word">${formattedDuration}</td>
             <td style="word-wrap: break-word">${formattedEndTime}</td>` :
            `<td style="word-wrap: break-word">
               ${currentSortBy === 'endTime' ? formattedEndTime : formattedDuration}
             </td>`
          }
          <td style="word-wrap: break-word"><button class="startButton" data-task="${originalTask}" data-project="${originalProject}" data-actors="${originalActors}">Start</button></td>
        </tr>`;
      } else if (currentAggregationLevel === 2) {
        csvContent += `${name},${formattedDuration},${csvFormattedEndTime}\n`;
        tasksHtml += `<tr>
          <td>${name}</td>
          <td style="word-wrap: break-word">${formattedDuration}</td>
          <td style="word-wrap: break-word">${formattedEndTime}</td>
        </tr>`;
      } else {
        csvContent += `${selectedNoteName || 'No note selected'},${formattedDuration},${csvFormattedEndTime}\n`;
        tasksHtml += `<tr>
          <td>${selectedNoteName || 'No note selected'}</td>
          <td style="word-wrap: break-word">${formattedDuration}</td>
          <td style="word-wrap: break-word">${formattedEndTime}</td>
        </tr>`;
      }
    });
    
    tasksHtml += '</table>';
    aggregationLevelDiv.classList.remove('hidden');
  } else {
    tasksHtml += '<p>No completed tasks</p>';
    aggregationLevelDiv.classList.add('hidden');
    csvContent = 'No completed tasks\n';
  }
  
  completedTasksDiv.innerHTML = tasksHtml;
  // Store the CSV content in a data attribute of the completedTasksDiv
  completedTasksDiv.setAttribute('data-csv-content', csvContent);
}

function changeSortOrder(sortBy) {
  if (sortBy !== currentSortBy) {
    currentSortBy = sortBy;
    webviewApi.postMessage({
      name: 'changeSortOrder',
      sortBy: currentSortBy
    });
  }
}

aggregationSlider.addEventListener('input', function() {
  currentAggregationLevel = parseInt(this.value);
  updateCompletedTasksDisplay();
  // Save the new aggregation level
  webviewApi.postMessage({
    name: 'setAggregationLevel',
    level: currentAggregationLevel
  });
});

taskFilter.addEventListener('input', function() {
  currentFilter = this.value;
  updateCompletedTasksDisplay();
});

taskFilter.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (taskFilter.value !== '') {
      taskFilter.value = '';
      currentFilter = '';
      updateCompletedTasksDisplay();
    } else {
      taskNameInput.focus();
    }
  }
});

// Initialize date inputs and add event listeners
function initializeDateInputs() {
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');

  startDateInput.addEventListener('change', () => applyDateFilter(startDateInput, endDateInput));
  endDateInput.addEventListener('change', () => applyDateFilter(startDateInput, endDateInput));

  // Use the defaultDateRange setting
  webviewApi.postMessage({
    name: 'getDefaultDateRange'
  });
}

function applyDateFilter(startDateInput, endDateInput) {
  const startDate = startDateInput.value || null;
  const endDate = endDateInput.value || null;
  
  if (startDate !== lastStartDate || endDate !== lastEndDate) {
    lastStartDate = startDate;
    lastEndDate = endDate;
    
    webviewApi.postMessage({
      name: 'applyDateFilter',
      startDate: startDate,
      endDate: endDate
    });
  }
}

function createAutocomplete(input, getItems, onSelect) {
  let autocompleteList = null;
  let selectedIndex = -1;

  const listeners = {
    input: handleInput,
    keydown: handleKeydown,
    blur: handleBlur,
    documentClick: handleDocumentClick
  };

  function setup() {
    input.addEventListener('input', listeners.input);
    input.addEventListener('keydown', listeners.keydown);
    input.addEventListener('blur', listeners.blur);
    document.addEventListener('click', listeners.documentClick);
  }

  function teardown() {
    input.removeEventListener('input', listeners.input);
    input.removeEventListener('keydown', listeners.keydown);
    input.removeEventListener('blur', listeners.blur);
    document.removeEventListener('click', listeners.documentClick);
    if (autocompleteList) {
      autocompleteList.remove();
      autocompleteList = null;
    }
  }

  function handleInput() {
    updateAutocompleteList();
  }

  function handleKeydown(e) {
    if (!autocompleteList || autocompleteList.style.display === 'none') {
      if (e.key === 'Enter') {
        e.preventDefault();
        onSelect(input.value);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        moveSelection(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveSelection(-1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex === -1) {
          // No item selected, use the current input value
          onSelect(input.value);
          hideAutocompleteList();
        } else {
          selectCurrentItem();
        }
        break;
      case 'Escape':
        hideAutocompleteList();
        break;
    }
  }

  function handleBlur() {
    setTimeout(hideAutocompleteList, 200);
  }

  function handleDocumentClick(e) {
    if (e.target !== input && autocompleteList) {
      hideAutocompleteList();
    }
  }

  function updateAutocompleteList() {
    const items = getItems();
    const value = input.value.toLowerCase();

    if (!value || items.length === 0) {
      hideAutocompleteList();
      return;
    }

    const matches = items
      .filter(item => item.toLowerCase().includes(value))
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    if (matches.length === 0) {
      hideAutocompleteList();
      return;
    }

    createOrUpdateList(matches);
  }

  function createOrUpdateList(matches) {
    if (!autocompleteList) {
      autocompleteList = document.createElement('ul');
      autocompleteList.className = 'autocomplete-list';
      input.parentNode.insertBefore(autocompleteList, input.nextSibling);
    }

    autocompleteList.innerHTML = '';
    matches.forEach((match, index) => {
      const li = document.createElement('li');
      li.textContent = match;
      li.addEventListener('click', () => selectItem(match));
      li.addEventListener('mouseenter', () => {
        selectedIndex = index;
        updateSelectedItem();
      });
      autocompleteList.appendChild(li);
    });

    autocompleteList.style.display = 'block';
    selectedIndex = -1;
    updateSelectedItem();
  }

  function hideAutocompleteList() {
    if (autocompleteList) {
      autocompleteList.style.display = 'none';
    }
  }

  function moveSelection(direction) {
    const items = autocompleteList.getElementsByTagName('li');
    selectedIndex = (selectedIndex + direction + items.length) % items.length;
    updateSelectedItem();
  }

  function updateSelectedItem() {
    const items = autocompleteList.getElementsByTagName('li');
    for (let i = 0; i < items.length; i++) {
      items[i].classList.toggle('selected', i === selectedIndex);
    }
    if (selectedIndex >= 0) {
      items[selectedIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  function selectCurrentItem() {
    const items = autocompleteList.getElementsByTagName('li');
    if (selectedIndex >= 0 && selectedIndex < items.length) {
      selectItem(items[selectedIndex].textContent);
    }
  }

  function selectItem(value) {
    input.value = value;
    hideAutocompleteList();
    onSelect(value);
  }

  setup();

  return {
    teardown,
    updateItems: updateAutocompleteList
  };
}

const taskAutocomplete = createAutocomplete(
  taskNameInput,
  () => uniqueTasks,
  (selectedTask) => {
    projectNameInput.focus();
  }
);

const projectAutocomplete = createAutocomplete(
  projectNameInput,
  () => uniqueProjects,
  (selectedProject) => {
    startButton.click();
  }
);

const actorsAutocomplete = createAutocomplete(
  actorsNameInput,
  () => uniqueActors,
  (selectedActor) => {
    startButton.click();
  }
);

function updateAutocompleteLists() {
  taskAutocomplete.updateItems();
  projectAutocomplete.updateItems();
  actorsAutocomplete.updateItems();
}

function formatDateTime(date) {
  return `${date.toLocaleDateString('en-CA')}<br>${date.toLocaleTimeString('en-CA', { hour12: false })}`;
}

document.getElementById('openNoteButton').addEventListener('click', openSelectedNote);

completedTasksDiv.addEventListener('click', function(event) {
  const target = event.target;
  if (target.classList.contains('sortable')) {
    const sortBy = target.dataset.sort;
    changeSortOrder(sortBy);
  }
});

function handleEscapeKey(input) {
  if (input.value !== '') {
    input.value = '';
  } else {
    taskNameInput.focus();
  }
}

taskNameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    handleEscapeKey(taskNameInput);
  }
});

projectNameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    handleEscapeKey(projectNameInput);
  }
});

actorsNameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    handleEscapeKey(actorsNameInput);
  }
});

// Wait for 1 second before requesting initial data
setTimeout(initializeDateInputs, 500);
setTimeout(requestInitialData, 1000);
