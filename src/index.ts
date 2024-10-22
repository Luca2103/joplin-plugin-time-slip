import joplin from 'api';
import { MenuItemLocation } from 'api/types';
import { TaskManager } from './taskManager';
import { NoteManager } from './noteManager';
import { registerSettings, getLogNoteTag, getDefaultNoteId, setDefaultNoteId, getCurrentDateRange, setCurrentDateRange, getAggregationLevel, setAggregationLevel, getSummarySortOrder } from './settings';

joplin.plugins.register({
  onStart: async function() {
    await registerSettings();
    const logNoteTag = await getLogNoteTag();
    const defaultNoteId = await getDefaultNoteId();

    const panel = await joplin.views.panels.create('timeSlipPanel');

    await joplin.views.panels.setHtml(panel, `
      <div id="timeTracker">
        <div class="input-group">
          <input type="text" id="taskName" placeholder="Task name">
          <input type="text" id="projectName" placeholder="Project name">
          <button id="startButton">Start</button>
        </div>
        <div class="note-selector-group">
          <select id="noteSelector">
            <option value="">To start, tag a new note with a time-slip tag</option>
          </select>
          <button id="openNoteButton" title="Open selected note">Open</button>
        </div>
        <div id="errorMessage"></div>
        <div id="runningTasks"></div>
        <div class="section-divider">
          <hr>
          <span>Completed Tasks</span>
          <hr>
        </div>
        <div class="filter-group">
          <div class="date-range">
            <input type="date" id="startDate" title="Start date for filtering completed tasks">
            <input type="date" id="endDate" title="End date for filtering completed tasks">
          </div>
          <input type="text" id="taskFilter" placeholder="Filter tasks" title="Filter tasks by name or project">
        </div>
        <div id="completedTasks"></div>
        <div class="aggregation-level hidden">
          <input type="range" id="aggregationSlider" min="1" max="3" value="1" step="1" title="Aggregation level for completed tasks">
          <div class="slider-labels">
            <span>Task</span>
            <span>Project</span>
            <span>Note</span>
          </div>
        </div>
      </div>
    `);

    await joplin.views.panels.addScript(panel, 'timeTracker.css');
    await joplin.views.panels.addScript(panel, 'timeTracker.js');

    let noteId = defaultNoteId;
    const noteManager = new NoteManager(joplin, noteId, panel);
    const taskManager = new TaskManager(joplin, panel, noteId, noteManager);
    noteManager.setTaskManager(taskManager);
    await taskManager.setLogNoteTag(logNoteTag);

    if (noteId) {
      await noteManager.setNoteId(noteId);
      await taskManager.setNoteId(noteId);
    }

    await joplin.workspace.onSyncComplete(async () => await taskManager.scanNoteAndUpdateTasks());
    await joplin.workspace.onNoteChange(noteManager.handleNoteChange);
    await joplin.workspace.onNoteSelectionChange(noteManager.handleNoteSelectionChange);

    await joplin.commands.register({
      name: 'timeslip.togglePanel',
      label: 'Toggle Time Slip panel',
      iconName: 'fas fa-stopwatch',
      execute: async () => {
        const isVisible = await joplin.views.panels.visible(panel);
        if (isVisible) {
          await joplin.views.panels.hide(panel);
        } else {
          await joplin.views.panels.show(panel);
        }
      }
    });
    await joplin.views.menuItems.create('timeslip.togglePanel', 'timeslip.togglePanel', MenuItemLocation.View);

    await joplin.commands.register({
      name: 'timeslip.sortTimeLog',
      label: 'Sort Time Slip log',
      iconName: 'fas fa-sort',
      execute: async () => {
        if (noteId) {
          await taskManager.updateEnforceSorting(true);
          await taskManager.scanNoteAndUpdateTasks();
          await taskManager.updateEnforceSorting();
        } else {
          await joplin.views.dialogs.showMessageBox('Please select a time log note first.');
        }
      }
    });
    await joplin.views.menuItems.create('timeslip.sortTimeLog', 'timeslip.sortTimeLog', MenuItemLocation.Note);

    await joplin.commands.register({
      name: 'timeslip.insertLogMarkdown',
      label: 'Insert Time Slip markdown log',
      iconName: 'fas fa-table',
      execute: async () => {
        if (noteId) {
          const exportedTable = await noteManager.exportNote();
          if (exportedTable) {
            await joplin.commands.execute('editor.focus');
            await joplin.commands.execute('editor.execCommand', {
              name: 'replaceSelection',
              args: [exportedTable],
            });
          } else {
            await joplin.views.dialogs.showMessageBox('Failed to render time slip.');
          }
        } else {
          await joplin.views.dialogs.showMessageBox('Please select a time log note first.');
        }
      }
    });
    await joplin.views.menuItems.create('timeslip.insertLogMarkdown', 'timeslip.insertLogMarkdown', MenuItemLocation.Note);

    await joplin.commands.register({
      name: 'timeslip.insertSummaryMarkdown',
      label: 'Insert Time Slip markdown summary',
      iconName: 'fas fa-markdown',
      execute: async () => {
        if (noteId) {
          // Request markdown summary table from the panel
          await joplin.views.panels.postMessage(panel, { name: 'requestSummaryMarkdown' });
        } else {
          await joplin.views.dialogs.showMessageBox('Please select a time log note first.');
        }
      }
    });
    await joplin.views.menuItems.create('timeslip.insertSummaryMarkdown', 'timeslip.insertSummaryMarkdown', MenuItemLocation.Note);

    await joplin.commands.register({
      name: 'timeslip.copyToClipboard',
      label: 'Copy Time Slip summary',
      iconName: 'fas fa-clipboard',
      execute: async () => {
        if (noteId) {
          // Request summary table from the panel
          await joplin.views.panels.postMessage(panel, { name: 'requestSummaryCSV' });
        } else {
          await joplin.views.dialogs.showMessageBox('Please select a time log note first.');
        }
      }
    });
    await joplin.views.menuItems.create('timeslip.copyToClipboard', 'timeslip.copyToClipboard', MenuItemLocation.Note);

    await joplin.settings.onChange(async (event) => {
      if (event.keys.includes('timeslip.logNoteTag')) {
        const newLogNoteTag = await joplin.settings.value('timeslip.logNoteTag');
        await taskManager.setLogNoteTag(newLogNoteTag);
        noteId = ''; // Reset the selected note
      }
      if (event.keys.includes('timeslip.summarySortOrder')) {
        const newSortOrder = await getSummarySortOrder();
        await taskManager.updateSummarySortOrder(newSortOrder);
      }
      if (event.keys.includes('timeslip.logSortOrder')) {
        await taskManager.updateLogSortOrder();
        await taskManager.scanNoteAndUpdateTasks();
      }
      if (event.keys.includes('timeslip.enforceLogSort')) {
        await taskManager.updateEnforceSorting();
        await taskManager.scanNoteAndUpdateTasks();
      }
    });

    await joplin.views.panels.onMessage(panel, async (message) => {
      if (message.name === 'changeNote') {
        noteId = message.noteId;
        await noteManager.setNoteId(noteId);
        await taskManager.setNoteId(noteId);
        if (noteId) {
          await taskManager.setDateRange(message.startDate, message.endDate);
          setCurrentDateRange(message.startDate, message.endDate);
          await taskManager.scanNoteAndUpdateTasks();
          // Save the selected note ID as the default
          await setDefaultNoteId(noteId);
        } else {
          // Clear tasks when no note is selected
          await taskManager.clearTasks();
          await setDefaultNoteId('');
        }

      } else if (message.name === 'start') {
        if (noteId) {
          await taskManager.startTask(message.taskName, message.projectName);
        } else {
          await joplin.views.panels.postMessage(panel, { 
            name: 'error', 
            message: 'Please select a note first.' 
          });
        }

      } else if (message.name === 'stop') {
        if (noteId) {
          await taskManager.stopTask(message.taskName, message.projectName);
        } else {
          console.error('No note selected. Cannot stop task.');
        }

      } else if (message.name === 'requestInitialData') {
        const initialData = await taskManager.getInitialData();
        const currentDateRange = await getCurrentDateRange();
        const aggregationLevel = await getAggregationLevel();
        await joplin.views.panels.postMessage(panel, {
          name: 'initialData',
          ...initialData,
          currentDateRange,
          aggregationLevel
        });

      } else if (message.name === 'applyDateFilter') {
        if (noteId) {
          await taskManager.setDateRange(message.startDate, message.endDate);
          setCurrentDateRange(message.startDate, message.endDate);
          await taskManager.scanNoteAndUpdateTasks();
        } else {
          await joplin.views.panels.postMessage(panel, { 
            name: 'error', 
            message: 'Please select a note first.' 
          });
        }

      } else if (message.name === 'getDefaultDateRange') {
        const currentDateRange = await getCurrentDateRange();
        await joplin.views.panels.postMessage(panel, {
          name: 'defaultDateRange',
          ...currentDateRange
        });

      } else if (message.name === 'setAggregationLevel') {
        await setAggregationLevel(message.level);

      } else if (message.name === 'openNote') {
        if (message.noteId) {
          await joplin.commands.execute('openNote', message.noteId);
        }

      } else if (message.name === 'changeSortOrder') {
        if (noteId) {
          await taskManager.updateSummarySortOrder(message.sortBy);
          await joplin.settings.setValue('timeslip.summarySortOrder', message.sortBy);
          await taskManager.scanNoteAndUpdateTasks();
        } else {
          await joplin.views.panels.postMessage(panel, { 
            name: 'error', 
            message: 'Please select a note first.' 
          });
        }

      } else if (message.name === 'summaryCSV') {
        // Copy the summary table to clipboard
        await joplin.clipboard.writeText(message.content);
        await joplin.views.dialogs.showMessageBox('Summary table has been copied to clipboard.');

      } else if (message.name === 'summaryMarkdown') {
        // Insert the markdown summary table at the current cursor position
        await joplin.commands.execute('editor.focus');
        await joplin.commands.execute('editor.execCommand', {
          name: 'replaceSelection',
          args: [message.content],
        });
      }
    });
  },
});
