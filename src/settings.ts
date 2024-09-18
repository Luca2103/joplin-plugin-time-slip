import joplin from 'api';
import { SettingItemType } from 'api/types'

export async function registerSettings() {
  await joplin.settings.registerSection('timeslip', {
    label: 'Time Slip',
    iconName: 'fas fa-stopwatch',
  });

  await joplin.settings.registerSettings({
    'timeslip.logNoteTag': {
      value: 'time-slip',
      type: SettingItemType.String,
      section: 'timeslip',
      public: true,
      label: 'Log note tag',
      description: 'Tag for notes that contain time tracking logs. Default: time-slip',
    },
    'timeslip.defaultNoteId': {
      value: '',
      type: SettingItemType.String,
      section: 'timeslip',
      public: true,
      label: 'Default log note ID',
    },
    'timeslip.defaultDateRange': {
      value: 7,
      minimum: 1,
      maximum: 365,
      step: 1,
      type: SettingItemType.Int,
      section: 'timeslip',
      public: true,
      label: 'Default date range (days)',
      description: 'The default number of days to show in the completed tasks list. Default: 7',
    },
  });
}

export async function getLogNoteTag(): Promise<string> {
  return await joplin.settings.value('timeslip.logNoteTag');
}

export async function getDefaultNoteId(): Promise<string> {
  return await joplin.settings.value('timeslip.defaultNoteId');
}

export async function setDefaultNoteId(noteId: string): Promise<void> {
  await joplin.settings.setValue('timeslip.defaultNoteId', noteId);
}

export async function getDefaultDateRange(): Promise<number> {
  return await joplin.settings.value('timeslip.defaultDateRange');
}

let currentStartDate: string | null = null;
let currentEndDate: string | null = null;

export async function getCurrentDateRange(): Promise<{ startDate: string | null; endDate: string | null }> {
  if (currentStartDate && currentEndDate) {
    return { startDate: currentStartDate, endDate: currentEndDate };
  } else {
    const defaultRange = await getDefaultDateRange();
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - defaultRange + 1);
    return {
      startDate: startDate.toLocaleDateString('en-CA'),
      endDate: endDate.toLocaleDateString('en-CA')
    };
  }
}

export function setCurrentDateRange(startDate: string | null, endDate: string | null): void {
  currentStartDate = startDate;
  currentEndDate = endDate;
}
