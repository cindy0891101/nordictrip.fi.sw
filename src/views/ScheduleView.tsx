import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal, NordicButton } from '../components/Shared';
import { MOCK_WEATHER, CATEGORY_COLORS } from '../constants';
import type { ScheduleItem, Category, WeatherInfo } from '../types';
import { dbService } from '../firebaseService';

/* =======================
   Types
======================= */

interface ExtendedWeatherInfo extends WeatherInfo {
  feelsLike: number;
}

interface ExtendedDayMetadata {
  locationName: string;
  forecast: ExtendedWeatherInfo[];
  isLive?: boolean;
}

interface DayData {
  items: ScheduleItem[];
  metadata: ExtendedDayMetadata;
}

interface ScheduleViewProps {
  isEditMode?: boolean;
  onToggleLock?: () => void;
}

/* =======================
   Utils
======================= */

const shiftTimeStr = (timeStr: string, minutes: number): string => {
  if (!timeStr) return '12:00';
  const [hours, mins] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours || 0, mins || 0, 0, 0);
  date.setMinutes(date.getMinutes() + minutes);
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes()
  ).padStart(2, '0')}`;
};

const T_CHINESE_MAP: Record<string, string> = {
  韩国: '韓國',
  首尔: '首爾',
  东京: '東京',
  大阪: '大阪',
  关西: '關西',
  京都: '京都',
  台北: '臺北',
  台中: '臺中',
  台南: '臺南',
  高雄: '高雄',
  中国: '中國',
  日本: '日本',
  泰国: '泰國',
  越南: '越南',
  新加坡: '新加坡'
};

const fixToTraditional = (text: string) => {
  let fixed = text || '';
  Object.keys(T_CHINESE_MAP).forEach((key) => {
    fixed = fixed.replace(new RegExp(key, 'g'), T_CHINESE_MAP[key]);
  });
  return fixed;
};

/* =======================
   Component
======================= */

const ScheduleView: React.FC<ScheduleViewProps> = ({
  isEditMode,
  onToggleLock
}) => {
  const [fullSchedule, setFullSchedule] = useState<Record<string, DayData>>({});

  /* ---------- Google Maps ---------- */
  const openInGoogleMaps = (address: string) => {
    if (!address) return;
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        address
      )}`,
      '_blank'
    );
  };

  /* ---------- Firebase ---------- */

  useEffect(() => {
    const unsubscribe = dbService.subscribeField('schedule', (data) => {
      if (data && typeof data === 'object') {
        setFullSchedule(data);
      } else {
        setFullSchedule({});
      }
    });
    return () => unsubscribe();
  }, []);

  const dates = useMemo(
    () => Object.keys(fullSchedule || {}).sort(),
    [fullSchedule]
  );
  const [selectedDate, setSelectedDate] = useState(dates[0] || '');
  const [timeLeft, setTimeLeft] = useState('');

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showManageDatesModal, setShowManageDatesModal] = useState(false);
  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const [showTimeShiftModal, setShowTimeShiftModal] = useState(false);

  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [newDateInput, setNewDateInput] = useState('');
  const [tempMetadata, setTempMetadata] =
    useState<ExtendedDayMetadata | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [dateToEdit, setDateToEdit] = useState<string | null>(null);
  const [dateRenameInput, setDateRenameInput] = useState('');
  const [shiftValue, setShiftValue] = useState(30);

  /* ---------- Effects ---------- */

  useEffect(() => {
    if (dates.length > 0 && !selectedDate) setSelectedDate(dates[0]);
    if (dates.length === 0) setSelectedDate('');
  }, [dates, selectedDate]);

  useEffect(() => {
    if (!dates.length) {
      setTimeLeft('尚未設定行程日期');
      return;
    }
    const update = () => {
      const diff =
        new Date(dates[0]).getTime() - new Date().getTime();
      setTimeLeft(
        diff < 0
          ? '旅程進行中'
          : `距離出發還有 ${Math.floor(
              diff / (1000 * 60 * 60 * 24)
            )} 天`
      );
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [dates]);

  /* ---------- Data ---------- */

  const updateScheduleCloud = (data: Record<string, DayData>) => {
    setFullSchedule(data);
    dbService.updateField('schedule', data);
  };

  const currentDayData = selectedDate
    ? fullSchedule[selectedDate] || {
        items: [],
        metadata: { locationName: '未設定', forecast: [], isLive: false }
      }
    : null;

  if (!currentDayData) return null;

  /* ---------- UI Helpers ---------- */

  const getCategoryIcon = (category: Category) => {
    switch (category) {
      case 'Transport':
        return 'fa-car';
      case 'Food':
        return 'fa-utensils';
      case 'Attraction':
        return 'fa-camera';
      case 'Accommodation':
        return 'fa-bed';
      case 'Activity':
        return 'fa-star';
      case 'Shopping':
        return 'fa-bag-shopping';
      default:
