// FOCUS — voetbal eerst, school slim gepland
// Expo Snack / Expo Go
//
// Benodigd:
// @react-native-async-storage/async-storage
// @expo/vector-icons

import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Alert,
  StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const NUTRITION_CHAT_STORAGE_KEY = 'FOCUS_nutrition_chat_v1';

// Je computer waarop straks de Python-backend draait.
// Zorg dat telefoon en computer op dezelfde wifi zitten.
const API_BASE_URL = 'http://192.168.0.115:3000';

const EVENTS_STORAGE_KEY = 'FOCUS_events_v5';
const PROFILE_STORAGE_KEY = 'FOCUS_profile_v1';
const ROUTINE_STORAGE_KEY = 'FOCUS_routine_v1';
const FOOD_STORAGE_KEY = 'FOCUS_food_v1';
const CHECKIN_STORAGE_KEY = 'FOCUS_checkin_v1';

const DEFAULT_PROFILE = {
  position: 'CAM',
  club: 'KSK Zandhoven',
  academy: 'Future Football Stars',
  level: 'Gewestelijk',
  goal: 'IP / Elite spelen',
};

const DEFAULT_ROUTINE = {
  sleep: '22:30',
  wake: '07:00',
  schoolStart: '08:30',
  schoolEnd: '16:00',
  nutritionNote:
    'Eet regelmatig en zorg rond training voor voldoende energie en vocht.',
};

const FOOTBALL_TYPES = [
  'Teamtraining',
  'Wedstrijd',
  'Individuele training',
  'Kracht',
  'Plyometrie',
  'Mobility/herstel',
];

const CATEGORY_OPTIONS = [
  'Voetbal',
  'School',
  'Herstel',
  'Overig',
];

const FOOD_FOCUS = [
  'Koolhydraten / energie',
  'Eiwitten / herstel',
  'Fruit & groenten',
  'Vocht',
  'Elektrolyten',
];

const MEAL_EXAMPLES = {
  Ontbijt: 'Havermout + melk + banaan + eieren',
  Lunch: 'Rijst/pasta/brood + kip/vis/eieren + groenten',
  Snack: 'Fruit + yoghurt of brood met beleg',
  Avondeten: 'Rijst/pasta/aardappelen + vis/vlees + groenten',
  'Rond training': 'Koolhydraatrijke snack + voldoende drinken',
};

function pad(n) {
  return String(n).padStart(2, '0');
}

function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}`;
}

function displayDate(key) {
  const d = new Date(`${key}T12:00:00`);

  return d.toLocaleDateString('nl-BE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);

  return d;
}

function getWeekKeys() {
  const start = getWeekStart();

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return dateKey(d);
  });
}

function formatTime(time) {
  if (!time) return '--:--';
  return time;
}

/* -------------------------------------------------------
   FOOTBALL LOAD
------------------------------------------------------- */

function footballLoad(type) {
  switch (type) {
    case 'Wedstrijd':
      return 100;

    case 'Teamtraining':
      return 70;

    case 'Individuele training':
      return 60;

    case 'Kracht':
      return 45;

    case 'Plyometrie':
      return 50;

    case 'Mobility/herstel':
      return 15;

    default:
      return 20;
  }
}

/* -------------------------------------------------------
   NUTRITION CONTEXT
   Dit zat eerst per ongeluk binnen footballLoad().
------------------------------------------------------- */

function getNutritionContext({
  profile,
  routine,
  events,
  food,
  checkin,
}) {
  const today = dateKey();

  const tomorrowDate = new Date();
  tomorrowDate.setDate(
    tomorrowDate.getDate() + 1
  );

  const tomorrow = dateKey(tomorrowDate);

  const todayEvents = events
    .filter((e) => e.date === today)
    .sort((a, b) =>
      (a.time || '').localeCompare(
        b.time || ''
      )
    );

  const tomorrowEvents = events
    .filter((e) => e.date === tomorrow)
    .sort((a, b) =>
      (a.time || '').localeCompare(
        b.time || ''
      )
    );

  const weekKeys = getWeekKeys();

  const weeklyLoad = events
    .filter(
      (e) =>
        weekKeys.includes(e.date) &&
        e.category === 'Voetbal'
    )
    .reduce(
      (sum, e) =>
        sum + footballLoad(e.footballType),
      0
    );

  return {
    date: today,

    player: {
      position: profile.position,
      club: profile.club,
      academy: profile.academy,
      level: profile.level,
      goal: profile.goal,
    },

    routine: {
      sleep: routine.sleep,
      wake: routine.wake,
      schoolStart: routine.schoolStart,
      schoolEnd: routine.schoolEnd,
      nutritionNote: routine.nutritionNote,
    },

    today: todayEvents,
    tomorrow: tomorrowEvents,

    weeklyFootballLoad: weeklyLoad,

    nutrition: {
      meals: food.meals,
      focus: food.focus,
      note: food.note,
      water: food.water,
    },

    checkin: {
      energy: checkin.energy,
      sleepQuality: checkin.sleepQuality,
      fatigue: checkin.fatigue,
    },
  };
}

/* -------------------------------------------------------
   FOOD SCORE
------------------------------------------------------- */

function getFoodScore(food) {
  if (!food) return 0;

  let score = 0;

  if (food.meals?.length) {
    score += Math.min(
      food.meals.length * 10,
      50
    );
  }

  if (food.focus?.length) {
    score += Math.min(
      food.focus.length * 7,
      35
    );
  }

  if (food.note?.trim()) {
    score += 10;
  }

  if (food.water) {
    score += 5;
  }

  return Math.min(score, 100);
}

/* -------------------------------------------------------
   COACH PLAN
------------------------------------------------------- */

function makeCoachPlan({
  routine,
  events,
  weeklyLoad,
  checkin,
  food,
}) {
  const today = dateKey();

  const tomorrowDate = new Date();
  tomorrowDate.setDate(
    tomorrowDate.getDate() + 1
  );

  const tomorrow = dateKey(tomorrowDate);

  const todayEvents = events
    .filter((e) => e.date === today)
    .sort((a, b) =>
      (a.time || '').localeCompare(
        b.time || ''
      )
    );

  const tomorrowEvents = events
    .filter((e) => e.date === tomorrow)
    .sort((a, b) =>
      (a.time || '').localeCompare(
        b.time || ''
      )
    );

  const todayFootball = todayEvents.filter(
    (e) => e.category === 'Voetbal'
  );

  const tomorrowMatch = tomorrowEvents.some(
    (e) => e.footballType === 'Wedstrijd'
  );

  const energy = Number(
    checkin.energy || 7
  );

  const sleepQuality = Number(
    checkin.sleepQuality || 7
  );

  const fatigue = Number(
    checkin.fatigue || 3
  );

  const highFatigue = fatigue >= 7;
  const lowEnergy = energy <= 4;
  const poorSleep = sleepQuality <= 4;

  let developmentBlock =
    'Techniek + individuele baltraining';

  if (
    highFatigue ||
    lowEnergy ||
    poorSleep
  ) {
    developmentBlock =
      'Rustige wandeling + lichte mobiliteit';
  } else if (tomorrowMatch) {
    developmentBlock =
      'Korte techniek + mobiliteit';
  } else if (weeklyLoad >= 300) {
    developmentBlock =
      'Herstel + lichte mobiliteit';
  }

  const foodScore = getFoodScore(food);

  return [
    {
      id: `coach-${today}-1`,
      time: routine.wake,
      title: 'Opstaan',
      subtitle:
        'Rustig starten + water drinken',
      type: 'routine',
    },

    {
      id: `coach-${today}-2`,
      time: addMinutes(
        routine.wake,
        20
      ),
      title: 'Ontbijt',
      subtitle:
        'Energie + eiwitten + fruit',
      type: 'nutrition',
    },

    {
      id: `coach-${today}-3`,
      time: routine.schoolStart,
      title: 'School',
      subtitle: 'Focus op school',
      type: 'school',
    },

    {
      id: `coach-${today}-4`,
      time: '10:30',
      title: 'Snack + drinkpauze',
      subtitle:
        'Even resetten en bijtanken',
      type: 'nutrition',
    },

    ...todayFootball.map(
      (event, index) => ({
        id: `coach-football-${
          event.id || index
        }`,
        time:
          event.time || '18:00',
        title: event.title,
        subtitle:
          event.footballType ||
          'Voetbal',
        type: 'football',
      })
    ),

    {
      id: `coach-${today}-5`,
      time: todayFootball.length
        ? '20:30'
        : '17:30',
      title: developmentBlock,
      subtitle: tomorrowMatch
        ? 'Morgen wedstrijd → fris blijven'
        : weeklyLoad >= 300
        ? 'Trainingsbelasting is al hoog'
        : 'Ontwikkeling zonder onnodige belasting',
      type: 'recovery',
    },

    {
      id: `coach-${today}-6`,
      time: '19:30',
      title: 'Avondeten',
      subtitle:
        'Volwaardige maaltijd + drinken',
      type: 'nutrition',
    },

    {
      id: `coach-${today}-7`,
      time: '21:30',
      title: 'Wind-down',
      subtitle:
        foodScore < 50
          ? 'Check voeding + rustig afsluiten'
          : 'Scherm rustiger + klaarmaken voor slaap',
      type: 'recovery',
    },

    {
      id: `coach-${today}-8`,
      time: routine.sleep,
      title: 'Slapen',
      subtitle:
        'Herstel voor morgen',
      type: 'sleep',
    },
  ];
}

function addMinutes(time, minutes) {
  if (!time || !time.includes(':')) {
    return time;
  }

  const [h, m] = time
    .split(':')
    .map(Number);

  const total =
    h * 60 + m + minutes;

  const normalized =
    ((total % 1440) + 1440) % 1440;

  return `${pad(
    Math.floor(normalized / 60)
  )}:${pad(normalized % 60)}`;
}

/* -------------------------------------------------------
   ACTIVITY CARD
------------------------------------------------------- */

function ActivityCard({
  event,
  onToggle,
  onDelete,
}) {
  return (
    <TouchableOpacity
      style={[
        styles.activityCard,
        event.completed &&
          styles.completedCard,
      ]}
      onPress={() =>
        onToggle(event.id)
      }
      onLongPress={() =>
        onDelete(event.id)
      }
    >
      <View style={styles.timeBox}>
        <Text style={styles.timeText}>
          {formatTime(event.time)}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.activityTitle,
            event.completed &&
              styles.completedText,
          ]}
        >
          {event.title}
        </Text>

        <Text style={styles.activitySub}>
          {event.category}
          {event.footballType
            ? ` • ${event.footballType}`
            : ''}
        </Text>
      </View>

      <Ionicons
        name={
          event.completed
            ? 'checkmark-circle'
            : 'ellipse-outline'
        }
        size={25}
        color={
          event.completed
            ? '#22c55e'
            : '#64748b'
        }
      />
    </TouchableOpacity>
  );
}

/* -------------------------------------------------------
   TODAY
------------------------------------------------------- */

function TodayScreen({
  selectedDate,
  events,
  setEvents,
  onAdd,
  profile,
}) {
  const dayEvents = events
    .filter(
      (e) => e.date === selectedDate
    )
    .sort((a, b) =>
      (a.time || '').localeCompare(
        b.time || ''
      )
    );

  const completed =
    dayEvents.filter(
      (e) => e.completed
    ).length;

  const toggleEvent = (id) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              completed:
                !e.completed,
            }
          : e
      )
    );
  };

  const deleteEvent = (id) => {
    Alert.alert(
      'Activiteit verwijderen?',
      'Houd een activiteit ingedrukt om ze te verwijderen.',
      [
        {
          text: 'Annuleren',
          style: 'cancel',
        },
        {
          text: 'Verwijderen',
          style: 'destructive',
          onPress: () =>
            setEvents((prev) =>
              prev.filter(
                (e) => e.id !== id
              )
            ),
        },
      ]
    );
  };

  return (
    <ScrollView
      contentContainerStyle={
        styles.scroll
      }
    >
      <View style={styles.hero}>
        <Text style={styles.smallLabel}>
          FOCUS • VANDAAG
        </Text>

        <Text style={styles.heroTitle}>
          Jouw dag.
        </Text>

        <Text style={styles.heroSub}>
          Voetbal eerst. De rest slim
          eromheen.
        </Text>
      </View>

      <View style={styles.profileMini}>
        <View>
          <Text style={styles.muted}>
            SPELER
          </Text>

          <Text
            style={styles.profileName}
          >
            {profile.position}
          </Text>
        </View>

        <View
          style={{
            alignItems: 'flex-end',
          }}
        >
          <Text style={styles.muted}>
            DOEL
          </Text>

          <Text
            style={styles.profileGoal}
          >
            {profile.goal}
          </Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>
            Vandaag
          </Text>

          <Text style={styles.muted}>
            {displayDate(selectedDate)}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={onAdd}
        >
          <Ionicons
            name="add"
            size={22}
            color="#fff"
          />

          <Text
            style={styles.addButtonText}
          >
            Toevoegen
          </Text>
        </TouchableOpacity>
      </View>

      {dayEvents.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons
            name="calendar-outline"
            size={32}
            color="#64748b"
          />

          <Text
            style={styles.emptyTitle}
          >
            Nog niets gepland
          </Text>

          <Text
            style={styles.emptyText}
          >
            Voeg een training,
            schooltaak of
            herstelmoment toe.
          </Text>
        </View>
      ) : (
        <>
          <View
            style={styles.progressCard}
          >
            <Text style={styles.muted}>
              DAGVOORTGANG
            </Text>

            <Text
              style={styles.progressNumber}
            >
              {completed}/
              {dayEvents.length}
            </Text>
          </View>

          {dayEvents.map((event) => (
            <ActivityCard
              key={event.id}
              event={event}
              onToggle={toggleEvent}
              onDelete={deleteEvent}
            />
          ))}
        </>
      )}
    </ScrollView>
  );
}

/* -------------------------------------------------------
   CALENDAR
------------------------------------------------------- */

function CalendarScreen({
  selectedDate,
  setSelectedDate,
  events,
  onAdd,
}) {
  const days = Array.from(
    { length: 14 },
    (_, i) => {
      const d = new Date();

      d.setDate(
        d.getDate() - 3 + i
      );

      return dateKey(d);
    }
  );

  return (
    <ScrollView
      contentContainerStyle={
        styles.scroll
      }
    >
      <Text style={styles.pageTitle}>
        Agenda
      </Text>

      <Text style={styles.pageSub}>
        Plan voetbal, school en herstel.
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={
          false
        }
        style={{ marginBottom: 18 }}
      >
        {days.map((day) => {
          const d = new Date(
            `${day}T12:00:00`
          );

          const selected =
            day === selectedDate;

          return (
            <TouchableOpacity
              key={day}
              style={[
                styles.dayPill,
                selected &&
                  styles.dayPillSelected,
              ]}
              onPress={() =>
                setSelectedDate(day)
              }
            >
              <Text
                style={[
                  styles.dayPillTop,
                  selected &&
                    styles.dayPillSelectedText,
                ]}
              >
                {d.toLocaleDateString(
                  'nl-BE',
                  {
                    weekday: 'short',
                  }
                )}
              </Text>

              <Text
                style={[
                  styles.dayPillNumber,
                  selected &&
                    styles.dayPillSelectedText,
                ]}
              >
                {d.getDate()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View
        style={styles.selectedDateCard}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.muted}>
            GESELECTEERDE DAG
          </Text>

          <Text
            style={styles.sectionTitle}
          >
            {displayDate(selectedDate)}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.circleAdd}
          onPress={onAdd}
        >
          <Ionicons
            name="add"
            size={25}
            color="#fff"
          />
        </TouchableOpacity>
      </View>

      {events
        .filter(
          (e) => e.date === selectedDate
        )
        .sort((a, b) =>
          (a.time || '').localeCompare(
            b.time || ''
          )
        )
        .map((event) => (
          <View
            key={event.id}
            style={styles.calendarEvent}
          >
            <Text
              style={styles.calendarTime}
            >
              {event.time}
            </Text>

            <View
              style={{ flex: 1 }}
            >
              <Text
                style={
                  styles.calendarTitle
                }
              >
                {event.title}
              </Text>

              <Text
                style={styles.activitySub}
              >
                {event.category}
                {event.footballType
                  ? ` • ${event.footballType}`
                  : ''}
              </Text>
            </View>
          </View>
        ))}
    </ScrollView>
  );
}

/* -------------------------------------------------------
   FOOTBALL
------------------------------------------------------- */

function FootballScreen({
  events,
  profile,
  onEditProfile,
}) {
  const weekKeys = getWeekKeys();

  const weekFootball =
    events.filter(
      (e) =>
        weekKeys.includes(e.date) &&
        e.category === 'Voetbal'
    );

  const trainings =
    weekFootball.filter(
      (e) =>
        e.footballType ===
        'Teamtraining'
    ).length;

  const matches =
    weekFootball.filter(
      (e) =>
        e.footballType ===
        'Wedstrijd'
    ).length;

  const strength =
    weekFootball.filter(
      (e) =>
        e.footballType ===
        'Kracht'
    ).length;

  const recovery =
    weekFootball.filter(
      (e) =>
        e.footballType ===
        'Mobility/herstel'
    ).length;

  const load =
    weekFootball.reduce(
      (sum, e) =>
        sum +
        footballLoad(
          e.footballType
        ),
      0
    );

  const next = events
    .filter(
      (e) =>
        e.category === 'Voetbal' &&
        e.date >= dateKey()
    )
    .sort((a, b) =>
      `${a.date}${a.time}`.localeCompare(
        `${b.date}${b.time}`
      )
    )[0];

  return (
    <ScrollView
      contentContainerStyle={
        styles.scroll
      }
    >
      <Text style={styles.pageTitle}>
        Voetbal
      </Text>

      <Text style={styles.pageSub}>
        Jouw ontwikkeling en
        trainingsbelasting.
      </Text>

      <View style={styles.playerCard}>
        <View style={styles.avatar}>
          <Ionicons
            name="football"
            size={30}
            color="#fff"
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.muted}>
            SPELERSPROFIEL
          </Text>

          <Text
            style={
              styles.playerPosition
            }
          >
            {profile.position}
          </Text>

          <Text
            style={styles.playerClub}
          >
            {profile.club}
          </Text>
        </View>
      </View>

      <View
        style={styles.profileDetails}
      >
        <InfoRow
          label="Academy"
          value={profile.academy}
        />

        <InfoRow
          label="Niveau"
          value={profile.level}
        />

        <InfoRow
          label="Doel"
          value={profile.goal}
        />

        <TouchableOpacity
          style={styles.outlineButton}
          onPress={onEditProfile}
        >
          <Ionicons
            name="create-outline"
            size={18}
            color="#111827"
          />

          <Text
            style={
              styles.outlineButtonText
            }
          >
            Profiel aanpassen
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>
        Deze week
      </Text>

      <View style={styles.statsGrid}>
        <StatBox
          value={trainings}
          label="Trainingen"
        />

        <StatBox
          value={matches}
          label="Wedstrijden"
        />

        <StatBox
          value={strength}
          label="Kracht"
        />

        <StatBox
          value={recovery}
          label="Herstel"
        />
      </View>

      <View style={styles.loadCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.muted}>
            TRAINING LOAD
          </Text>

          <Text
            style={styles.loadNumber}
          >
            {load}
          </Text>
        </View>

        <View style={styles.loadIcon}>
          <Ionicons
            name="pulse-outline"
            size={30}
            color="#111827"
          />
        </View>
      </View>

      <View style={styles.nextCard}>
        <Text style={styles.muted}>
          VOLGENDE VOETBALACTIVITEIT
        </Text>

        {next ? (
          <>
            <Text
              style={styles.nextTitle}
            >
              {next.title}
            </Text>

            <Text style={styles.nextSub}>
              {displayDate(next.date)} •{' '}
              {next.time}
            </Text>
          </>
        ) : (
          <>
            <Text
              style={styles.nextTitle}
            >
              Nog niets gepland
            </Text>

            <Text style={styles.nextSub}>
              Voeg je volgende training
              toe via Agenda.
            </Text>
          </>
        )}
      </View>

      <Text style={styles.sectionTitle}>
        Ontwikkeling
      </Text>

      <DevelopmentCard
        icon="footsteps-outline"
        title="Techniek"
        text="Balcontrole, dribbelen, passen en acties onder druk."
      />

      <DevelopmentCard
        icon="barbell-outline"
        title="Fysiek"
        text="Kracht, stabiliteit en explosiviteit naast voetbal."
      />

      <DevelopmentCard
        icon="eye-outline"
        title="Football IQ"
        text="Scannen, positie kiezen en sneller beslissen."
      />
    </ScrollView>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>
        {label}
      </Text>

      <Text style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}

function StatBox({ value, label }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>
        {value}
      </Text>

      <Text style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

function DevelopmentCard({
  icon,
  title,
  text,
}) {
  return (
    <View
      style={styles.developmentCard}
    >
      <View
        style={styles.developmentIcon}
      >
        <Ionicons
          name={icon}
          size={24}
          color="#111827"
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={
            styles.developmentTitle
          }
        >
          {title}
        </Text>

        <Text
          style={
            styles.developmentText
          }
        >
          {text}
        </Text>
      </View>
    </View>
  );
}

/* -------------------------------------------------------
   NUTRITION AI
------------------------------------------------------- */

function NutritionScreen({
  food,
  setFood,
  profile,
  routine,
  events,
  checkin,
}) {
  const score = getFoodScore(food);

  const [messages, setMessages] =
    useState([]);

  const [input, setInput] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const toggleMeal = (meal) => {
    setFood((prev) => ({
      ...prev,
      meals: prev.meals.includes(meal)
        ? prev.meals.filter(
            (x) => x !== meal
          )
        : [...prev.meals, meal],
    }));
  };

  const toggleFocus = (focus) => {
    setFood((prev) => ({
      ...prev,
      focus: prev.focus.includes(focus)
        ? prev.focus.filter(
            (x) => x !== focus
          )
        : [...prev.focus, focus],
    }));
  };

  useEffect(() => {
    async function loadChat() {
      try {
        const stored =
          await AsyncStorage.getItem(
            NUTRITION_CHAT_STORAGE_KEY
          );

        if (stored) {
          setMessages(
            JSON.parse(stored)
          );
        }
      } catch (error) {
        console.log(
          'Nutrition chat load error:',
          error
        );
      }
    }

    loadChat();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(
      NUTRITION_CHAT_STORAGE_KEY,
      JSON.stringify(messages)
    ).catch(() => {});
  }, [messages]);

  const sendMessage = async (
    customMessage
  ) => {
    const text = (
      customMessage !== undefined
        ? customMessage
        : input
    ).trim();

    if (!text || loading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
    };

    setMessages((prev) => [
      ...prev,
      userMessage,
    ]);

    setInput('');
    setLoading(true);

    try {
      const context =
        getNutritionContext({
          profile,
          routine,
          events,
          food,
          checkin,
        });

      const response =
        await fetch(
          `${API_BASE_URL}/nutrition-ai`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              message: text,
              context,
            }),
          }
        );

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'AI request mislukt'
        );
      }

      const aiMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        text:
          data.answer ||
          'Ik kreeg geen antwoord van de Nutrition AI.',
      };

      setMessages((prev) => [
        ...prev,
        aiMessage,
      ]);
    } catch (error) {
      console.log(
        'Nutrition AI error:',
        error
      );

      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          text:
            'Ik kan de Nutrition AI momenteel niet bereiken. Controleer of je backend draait en of API_BASE_URL klopt.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    Alert.alert(
      'Chat wissen?',
      'Alle berichten van Nutrition AI worden verwijderd.',
      [
        {
          text: 'Annuleren',
          style: 'cancel',
        },

        {
          text: 'Wissen',
          style: 'destructive',
          onPress: () =>
            setMessages([]),
        },
      ]
    );
  };

  const quickPrompts = [
    'Beoordeel mijn voeding',
    'Wat eten voor training?',
    'Wat eten na training?',
    'Wat eten voor een wedstrijd?',
    'Welke koolhydraten zijn goed voor voetbal?',
  ];

  return (
    <ScrollView
      contentContainerStyle={
        styles.scroll
      }
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.pageTitle}>
        Voeding
      </Text>

      <Text style={styles.pageSub}>
        Energie, herstel en een goede
        basis voor voetbal.
      </Text>

      <View style={styles.fuelHero}>
        <Text style={styles.smallLabel}>
          FOCUS FUEL
        </Text>

        <Text style={styles.fuelScore}>
          {score}
        </Text>

        <Text
          style={styles.fuelScoreLabel}
        >
          / 100
        </Text>

        <Text style={styles.fuelText}>
          Deze score is een eenvoudige
          logboekscore. Nutrition AI
          kijkt inhoudelijk naar wat je
          eet.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>
        Maaltijdstructuur
      </Text>

      {Object.keys(
        MEAL_EXAMPLES
      ).map((meal) => {
        const checked =
          food.meals.includes(meal);

        return (
          <TouchableOpacity
            key={meal}
            style={[
              styles.foodRow,
              checked &&
                styles.foodRowChecked,
            ]}
            onPress={() =>
              toggleMeal(meal)
            }
          >
            <Ionicons
              name={
                checked
                  ? 'checkmark-circle'
                  : 'ellipse-outline'
              }
              size={25}
              color={
                checked
                  ? '#22c55e'
                  : '#64748b'
              }
            />

            <View
              style={{ flex: 1 }}
            >
              <Text
                style={styles.foodTitle}
              >
                {meal}
              </Text>

              <Text
                style={styles.foodExample}
              >
                {MEAL_EXAMPLES[meal]}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}

      <Text style={styles.sectionTitle}>
        Waar let je vandaag op?
      </Text>

      {FOOD_FOCUS.map((focus) => {
        const checked =
          food.focus.includes(focus);

        return (
          <TouchableOpacity
            key={focus}
            style={[
              styles.focusChip,
              checked &&
                styles.focusChipSelected,
            ]}
            onPress={() =>
              toggleFocus(focus)
            }
          >
            <Ionicons
              name={
                checked
                  ? 'checkmark-circle'
                  : 'ellipse-outline'
              }
              size={20}
              color={
                checked
                  ? '#111827'
                  : '#64748b'
              }
            />

            <Text
              style={[
                styles.focusChipText,
                checked &&
                  styles.focusChipTextSelected,
              ]}
            >
              {focus}
            </Text>
          </TouchableOpacity>
        );
      })}

      <View
        style={styles.foodNoteCard}
      >
        <Text style={styles.muted}>
          WAT HEB JE GEGETEN?
        </Text>

        <TextInput
          style={styles.textArea}
          value={food.note}
          onChangeText={(text) =>
            setFood((prev) => ({
              ...prev,
              note: text,
            }))
          }
          placeholder="Bijv. havermout, brood, pasta, kip, fruit..."
          placeholderTextColor="#94a3b8"
          multiline
        />

        <TouchableOpacity
          style={[
            styles.waterButton,
            food.water &&
              styles.waterButtonSelected,
          ]}
          onPress={() =>
            setFood((prev) => ({
              ...prev,
              water: !prev.water,
            }))
          }
        >
          <Ionicons
            name="water-outline"
            size={21}
            color="#111827"
          />

          <Text
            style={styles.waterText}
          >
            Ik heb vandaag bewust op
            drinken gelet
          </Text>

          {food.water && (
            <Ionicons
              name="checkmark-circle"
              size={21}
              color="#22c55e"
            />
          )}
        </TouchableOpacity>
      </View>

      {/* NUTRITION AI */}

      <View
        style={styles.nutritionAIHeader}
      >
        <View>
          <Text
            style={styles.sectionTitle}
          >
            FOCUS Nutrition AI
          </Text>

          <Text style={styles.muted}>
            Vraag advies over je voeding
            en voetbal.
          </Text>
        </View>

        {messages.length > 0 && (
          <TouchableOpacity
            style={
              styles.clearChatButton
            }
            onPress={clearChat}
          >
            <Ionicons
              name="trash-outline"
              size={17}
              color="#64748b"
            />
          </TouchableOpacity>
        )}
      </View>

      <View
        style={styles.nutritionAICard}
      >
        <View
          style={styles.nutritionAIHero}
        >
          <View
            style={styles.nutritionAIIcon}
          >
            <Ionicons
              name="sparkles"
              size={24}
              color="#fff"
            />
          </View>

          <View
            style={{ flex: 1 }}
          >
            <Text
              style={
                styles.nutritionAITitle
              }
            >
              Slimme voedingscoach
            </Text>

            <Text
              style={
                styles.nutritionAISubtitle
              }
            >
              Ik ken je
              voetbalplanning,
              check-in en
              voedingslog.
            </Text>
          </View>
        </View>

        <View
          style={styles.quickPromptWrap}
        >
          {quickPrompts.map(
            (prompt) => (
              <TouchableOpacity
                key={prompt}
                style={
                  styles.quickPrompt
                }
                onPress={() => {
                  if (
                    prompt ===
                    'Beoordeel mijn voeding'
                  ) {
                    const foodDescription =
                      food.note.trim();

                    if (
                      !foodDescription
                    ) {
                      Alert.alert(
                        'Voeding ontbreekt',
                        'Schrijf eerst bij "Wat heb je gegeten?" wat je vandaag hebt gegeten.'
                      );

                      return;
                    }

                    sendMessage(
                      `Beoordeel wat ik vandaag heb gegeten. Geef een korte beoordeling van mijn voeding voor voetbal en vertel wat ik eventueel kan verbeteren. Mijn voeding: ${foodDescription}`
                    );

                    return;
                  }

                  sendMessage(prompt);
                }}
              >
                <Text
                  style={
                    styles.quickPromptText
                  }
                >
                  {prompt}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>

        {messages.length > 0 && (
          <View
            style={styles.chatMessages}
          >
            {messages.map(
              (message) => (
                <View
                  key={message.id}
                  style={[
                    styles.chatBubble,
                    message.role ===
                    'user'
                      ? styles.chatBubbleUser
                      : styles.chatBubbleAI,
                  ]}
                >
                  <Text
                    style={[
                      styles.chatBubbleText,
                      message.role ===
                        'user' &&
                        styles.chatBubbleTextUser,
                    ]}
                  >
                    {message.text}
                  </Text>
                </View>
              )
            )}
          </View>
        )}

        {loading && (
          <View
            style={styles.aiTyping}
          >
            <Ionicons
              name="sparkles-outline"
              size={17}
              color="#64748b"
            />

            <Text
              style={styles.aiTypingText}
            >
              Nutrition AI denkt
              na...
            </Text>
          </View>
        )}

        <View
          style={styles.chatInputRow}
        >
          <TextInput
            style={styles.chatInput}
            value={input}
            onChangeText={setInput}
            placeholder="Vraag iets over je voeding..."
            placeholderTextColor="#94a3b8"
            multiline
            editable={!loading}
          />

          <TouchableOpacity
            style={[
              styles.chatSendButton,
              (!input.trim() ||
                loading) &&
                styles.chatSendButtonDisabled,
            ]}
            disabled={
              !input.trim() ||
              loading
            }
            onPress={() =>
              sendMessage()
            }
          >
            <Ionicons
              name="arrow-up"
              size={21}
              color="#fff"
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tipCard}>
        <Ionicons
          name="bulb-outline"
          size={24}
          color="#111827"
        />

        <Text style={styles.tipText}>
          Voor een jonge voetballer
          draait voeding vooral om
          voldoende energie,
          regelmaat, variatie,
          drinken en herstel —
          niet om calorieën tellen
          of strenge diëten.
        </Text>
      </View>
    </ScrollView>
  );
}

/* -------------------------------------------------------
   SCHOOL
------------------------------------------------------- */

function SchoolScreen({
  events,
  onAdd,
}) {
  const schoolEvents =
    events
      .filter(
        (e) => e.category === 'School'
      )
      .sort((a, b) =>
        `${a.date}${a.time}`.localeCompare(
          `${b.date}${b.time}`
        )
      );

  return (
    <ScrollView
      contentContainerStyle={
        styles.scroll
      }
    >
      <View style={styles.sectionHeader}>
        <View>
          <Text
            style={styles.pageTitle}
          >
            School
          </Text>

          <Text
            style={styles.pageSub}
          >
            School slim rond voetbal
            plannen.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.circleAdd}
          onPress={onAdd}
        >
          <Ionicons
            name="add"
            size={25}
            color="#fff"
          />
        </TouchableOpacity>
      </View>

      <View style={styles.schoolHero}>
        <Ionicons
          name="school-outline"
          size={34}
          color="#111827"
        />

        <View style={{ flex: 1 }}>
          <Text
            style={
              styles.schoolHeroTitle
            }
          >
            School is je backup én
            je structuur.
          </Text>

          <Text
            style={
              styles.schoolHeroText
            }
          >
            Plan taken en toetsen zodat
            ze niet botsen met je
            voetbalontwikkeling.
          </Text>
        </View>
      </View>

      {schoolEvents.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text
            style={styles.emptyTitle}
          >
            Nog geen
            schoolactiviteiten
          </Text>

          <Text
            style={styles.emptyText}
          >
            Voeg een taak, toets of
            studieblok toe.
          </Text>
        </View>
      ) : (
        schoolEvents.map(
          (event) => (
            <View
              key={event.id}
              style={
                styles.calendarEvent
              }
            >
              <View
                style={
                  styles.schoolDate
                }
              >
                <Text
                  style={
                    styles.schoolDateDay
                  }
                >
                  {
                    new Date(
                      `${event.date}T12:00:00`
                    ).getDate()
                  }
                </Text>

                <Text
                  style={
                    styles.schoolDateMonth
                  }
                >
                  {new Date(
                    `${event.date}T12:00:00`
                  ).toLocaleDateString(
                    'nl-BE',
                    {
                      month: 'short',
                    }
                  )}
                </Text>
              </View>

              <View
                style={{ flex: 1 }}
              >
                <Text
                  style={
                    styles.calendarTitle
                  }
                >
                  {event.title}
                </Text>

                <Text
                  style={
                    styles.activitySub
                  }
                >
                  {event.time}
                </Text>
              </View>
            </View>
          )
        )
      )}
    </ScrollView>
  );
}

/* -------------------------------------------------------
   AI COACH
------------------------------------------------------- */

function AICoachScreen({
  events,
  routine,
  setRoutine,
  food,
  checkin,
  setCheckin,
}) {
  const [plan, setPlan] =
    useState([]);

  const weekKeys = getWeekKeys();

  const weeklyLoad =
    events
      .filter(
        (e) =>
          weekKeys.includes(e.date) &&
          e.category === 'Voetbal'
      )
      .reduce(
        (sum, e) =>
          sum +
          footballLoad(
            e.footballType
          ),
        0
      );

  const generate = () => {
    const newPlan =
      makeCoachPlan({
        routine,
        events,
        weeklyLoad,
        checkin,
        food,
      });

    setPlan(newPlan);
  };

  return (
    <ScrollView
      contentContainerStyle={
        styles.scroll
      }
    >
      <Text style={styles.pageTitle}>
        AI Coach
      </Text>

      <Text style={styles.pageSub}>
        Een slimme dagplanning rond
        voetbal, school en herstel.
      </Text>

      <View style={styles.aiHero}>
        <View style={styles.aiIcon}>
          <Ionicons
            name="sparkles"
            size={28}
            color="#fff"
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={styles.aiHeroTitle}
          >
            FOCUS Coach
          </Text>

          <Text
            style={styles.aiHeroText}
          >
            Geef aan hoe je je voelt.
            FOCUS maakt daarna een
            praktische dagindeling.
          </Text>
        </View>
      </View>

      <View
        style={styles.checkinCard}
      >
        <Text
          style={styles.sectionTitle}
        >
          Check-in
        </Text>

        <ScoreInput
          label="Energie"
          value={checkin.energy}
          onChange={(value) =>
            setCheckin((prev) => ({
              ...prev,
              energy: value,
            }))
          }
        />

        <ScoreInput
          label="Slaapkwaliteit"
          value={
            checkin.sleepQuality
          }
          onChange={(value) =>
            setCheckin((prev) => ({
              ...prev,
              sleepQuality: value,
            }))
          }
        />

        <ScoreInput
          label="Spiervermoeidheid"
          value={checkin.fatigue}
          onChange={(value) =>
            setCheckin((prev) => ({
              ...prev,
              fatigue: value,
            }))
          }
        />
      </View>

      <View
        style={styles.routineCard}
      >
        <View
          style={styles.sectionHeader}
        >
          <View>
            <Text
              style={
                styles.sectionTitle
              }
            >
              Jouw vaste ritme
            </Text>

            <Text style={styles.muted}>
              Dit gebruikt de coach
              voor je planning.
            </Text>
          </View>

          <RoutineEditButton
            routine={routine}
            setRoutine={setRoutine}
          />
        </View>

        <InfoRow
          label="Opstaan"
          value={routine.wake}
        />

        <InfoRow
          label="School"
          value={`${routine.schoolStart} – ${routine.schoolEnd}`}
        />

        <InfoRow
          label="Slapen"
          value={routine.sleep}
        />
      </View>

      <TouchableOpacity
        style={styles.generateButton}
        onPress={generate}
      >
        <Ionicons
          name="sparkles"
          size={21}
          color="#fff"
        />

        <Text
          style={styles.generateText}
        >
          Genereer mijn dag
        </Text>
      </TouchableOpacity>

      {plan.length > 0 && (
        <>
          <Text
            style={styles.sectionTitle}
          >
            Jouw FOCUS-dag
          </Text>

          {plan.map((item) => (
            <View
              key={item.id}
              style={styles.planItem}
            >
              <View
                style={styles.planTime}
              >
                <Text
                  style={
                    styles.planTimeText
                  }
                >
                  {item.time}
                </Text>
              </View>

              <View
                style={styles.planDot}
              >
                <Ionicons
                  name={
                    item.type ===
                    'football'
                      ? 'football-outline'
                      : item.type ===
                        'nutrition'
                      ? 'restaurant-outline'
                      : item.type ===
                        'school'
                      ? 'school-outline'
                      : item.type ===
                        'sleep'
                      ? 'moon-outline'
                      : 'body-outline'
                  }
                  size={19}
                  color="#111827"
                />
              </View>

              <View
                style={{ flex: 1 }}
              >
                <Text
                  style={styles.planTitle}
                >
                  {item.title}
                </Text>

                <Text
                  style={styles.planSub}
                >
                  {item.subtitle}
                </Text>
              </View>
            </View>
          ))}
        </>
      )}

      <View
        style={styles.aiDisclaimer}
      >
        <Ionicons
          name="information-circle-outline"
          size={21}
          color="#64748b"
        />

        <Text
          style={
            styles.aiDisclaimerText
          }
        >
          De coach helpt met planning
          en herstelkeuzes. Hij stelt
          geen medische diagnose.
        </Text>
      </View>
    </ScrollView>
  );
}

/* -------------------------------------------------------
   SCORE INPUT
------------------------------------------------------- */

function ScoreInput({
  label,
  value,
  onChange,
}) {
  return (
    <View
      style={{ marginBottom: 17 }}
    >
      <View
        style={styles.scoreHeader}
      >
        <Text
          style={styles.scoreLabel}
        >
          {label}
        </Text>

        <Text
          style={styles.scoreValue}
        >
          {value}/10
        </Text>
      </View>

      <View
        style={styles.scoreRow}
      >
        {Array.from(
          { length: 10 },
          (_, i) => {
            const number = i + 1;
            const active =
              Number(value) ===
              number;

            return (
              <TouchableOpacity
                key={number}
                style={[
                  styles.scoreCircle,
                  active &&
                    styles.scoreCircleActive,
                ]}
                onPress={() =>
                  onChange(number)
                }
              >
                <Text
                  style={[
                    styles.scoreCircleText,
                    active &&
                      styles.scoreCircleTextActive,
                  ]}
                >
                  {number}
                </Text>
              </TouchableOpacity>
            );
          }
        )}
      </View>
    </View>
  );
}

/* -------------------------------------------------------
   ROUTINE MODAL
------------------------------------------------------- */

function RoutineEditButton({
  routine,
  setRoutine,
}) {
  const [visible, setVisible] =
    useState(false);

  const [draft, setDraft] =
    useState(routine);

  useEffect(() => {
    setDraft(routine);
  }, [routine]);

  const save = () => {
    setRoutine(draft);
    setVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.editSmall}
        onPress={() =>
          setVisible(true)
        }
      >
        <Ionicons
          name="create-outline"
          size={18}
          color="#111827"
        />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
      >
        <View
          style={styles.modalOverlay}
        >
          <View
            style={styles.modalCard}
          >
            <View
              style={styles.modalHeader}
            >
              <Text
                style={styles.modalTitle}
              >
                Vaste tijden
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setVisible(false)
                }
              >
                <Ionicons
                  name="close"
                  size={26}
                  color="#111827"
                />
              </TouchableOpacity>
            </View>

            <LabeledInput
              label="Opstaan"
              value={draft.wake}
              onChangeText={(text) =>
                setDraft((p) => ({
                  ...p,
                  wake: text,
                }))
              }
              placeholder="07:00"
            />

            <LabeledInput
              label="Slapen"
              value={draft.sleep}
              onChangeText={(text) =>
                setDraft((p) => ({
                  ...p,
                  sleep: text,
                }))
              }
              placeholder="22:30"
            />

            <LabeledInput
              label="School start"
              value={
                draft.schoolStart
              }
              onChangeText={(text) =>
                setDraft((p) => ({
                  ...p,
                  schoolStart: text,
                }))
              }
              placeholder="08:30"
            />

            <LabeledInput
              label="School einde"
              value={draft.schoolEnd}
              onChangeText={(text) =>
                setDraft((p) => ({
                  ...p,
                  schoolEnd: text,
                }))
              }
              placeholder="16:00"
            />

            <LabeledInput
              label="Voedingsnotitie"
              value={
                draft.nutritionNote
              }
              onChangeText={(text) =>
                setDraft((p) => ({
                  ...p,
                  nutritionNote: text,
                }))
              }
              placeholder="Bijv. extra aandacht voor drinken"
            />

            <TouchableOpacity
              style={styles.saveButton}
              onPress={save}
            >
              <Text
                style={
                  styles.saveButtonText
                }
              >
                Opslaan
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

/* -------------------------------------------------------
   FOOD LOG MODAL
------------------------------------------------------- */

function FoodLogModal({
  visible,
  onClose,
  food,
  setFood,
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
    >
      <View
        style={styles.modalOverlay}
      >
        <View
          style={styles.modalCard}
        >
          <View
            style={styles.modalHeader}
          >
            <Text
              style={styles.modalTitle}
            >
              Voeding vandaag
            </Text>

            <TouchableOpacity
              onPress={onClose}
            >
              <Ionicons
                name="close"
                size={26}
                color="#111827"
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.muted}>
            Gebruik dit als simpele
            check-in, niet als
            calorieënteller.
          </Text>

          <TextInput
            style={[
              styles.textArea,
              { marginTop: 15 },
            ]}
            value={food.note}
            onChangeText={(text) =>
              setFood((prev) => ({
                ...prev,
                note: text,
              }))
            }
            placeholder="Wat heb je vandaag gegeten?"
            placeholderTextColor="#94a3b8"
            multiline
          />

          <TouchableOpacity
            style={styles.saveButton}
            onPress={onClose}
          >
            <Text
              style={
                styles.saveButtonText
              }
            >
              Opslaan
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* -------------------------------------------------------
   PROFILE MODAL
------------------------------------------------------- */

function ProfileModal({
  visible,
  onClose,
  profile,
  setProfile,
}) {
  const [draft, setDraft] =
    useState(profile);

  useEffect(() => {
    if (visible) {
      setDraft(profile);
    }
  }, [visible, profile]);

  const save = () => {
    setProfile(draft);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
    >
      <View
        style={styles.modalOverlay}
      >
        <View
          style={styles.modalCard}
        >
          <View
            style={styles.modalHeader}
          >
            <Text
              style={styles.modalTitle}
            >
              Voetbalprofiel
            </Text>

            <TouchableOpacity
              onPress={onClose}
            >
              <Ionicons
                name="close"
                size={26}
                color="#111827"
              />
            </TouchableOpacity>
          </View>

          <LabeledInput
            label="Positie"
            value={draft.position}
            onChangeText={(text) =>
              setDraft((p) => ({
                ...p,
                position: text,
              }))
            }
            placeholder="CAM"
          />

          <LabeledInput
            label="Club"
            value={draft.club}
            onChangeText={(text) =>
              setDraft((p) => ({
                ...p,
                club: text,
              }))
            }
            placeholder="Club"
          />

          <LabeledInput
            label="Academy / traject"
            value={draft.academy}
            onChangeText={(text) =>
              setDraft((p) => ({
                ...p,
                academy: text,
              }))
            }
            placeholder="Academy"
          />

          <LabeledInput
            label="Niveau"
            value={draft.level}
            onChangeText={(text) =>
              setDraft((p) => ({
                ...p,
                level: text,
              }))
            }
            placeholder="IP / Elite"
          />

          <LabeledInput
            label="Doel"
            value={draft.goal}
            onChangeText={(text) =>
              setDraft((p) => ({
                ...p,
                goal: text,
              }))
            }
            placeholder="Mijn voetbaldoel"
          />

          <TouchableOpacity
            style={styles.saveButton}
            onPress={save}
          >
            <Text
              style={
                styles.saveButtonText
              }
            >
              Profiel opslaan
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* -------------------------------------------------------
   LABELED INPUT
------------------------------------------------------- */

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
}) {
  return (
    <View
      style={{ marginBottom: 15 }}
    >
      <Text style={styles.inputLabel}>
        {label}
      </Text>

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
      />
    </View>
  );
}

/* -------------------------------------------------------
   ADD ACTIVITY
------------------------------------------------------- */

function AddActivityModal({
  visible,
  onClose,
  selectedDate,
  setEvents,
}) {
  const [title, setTitle] =
    useState('');

  const [time, setTime] =
    useState('18:00');

  const [category, setCategory] =
    useState('Voetbal');

  const [footballType, setFootballType] =
    useState('Teamtraining');

  const reset = () => {
    setTitle('');
    setTime('18:00');
    setCategory('Voetbal');
    setFootballType(
      'Teamtraining'
    );
  };

  const save = () => {
    if (!title.trim()) {
      Alert.alert(
        'Naam ontbreekt',
        'Geef je activiteit eerst een naam.'
      );

      return;
    }

    const newEvent = {
      id: `${Date.now()}-${Math.random()}`,
      date: selectedDate,
      time,
      title: title.trim(),
      category,

      footballType:
        category === 'Voetbal'
          ? footballType
          : '',

      completed: false,
    };

    setEvents((prev) => [
      ...prev,
      newEvent,
    ]);

    reset();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
    >
      <View
        style={styles.modalOverlay}
      >
        <View
          style={styles.modalCard}
        >
          <View
            style={styles.modalHeader}
          >
            <View>
              <Text
                style={styles.modalTitle}
              >
                Activiteit toevoegen
              </Text>

              <Text
                style={styles.muted}
              >
                {displayDate(
                  selectedDate
                )}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                reset();
                onClose();
              }}
            >
              <Ionicons
                name="close"
                size={26}
                color="#111827"
              />
            </TouchableOpacity>
          </View>

          <LabeledInput
            label="Naam"
            value={title}
            onChangeText={setTitle}
            placeholder="Bijv. Teamtraining"
          />

          <LabeledInput
            label="Tijd"
            value={time}
            onChangeText={setTime}
            placeholder="18:00"
          />

          <Text
            style={styles.inputLabel}
          >
            Categorie
          </Text>

          <View
            style={styles.optionWrap}
          >
            {CATEGORY_OPTIONS.map(
              (option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.optionChip,
                    category ===
                      option &&
                      styles.optionChipSelected,
                  ]}
                  onPress={() =>
                    setCategory(
                      option
                    )
                  }
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      category ===
                        option &&
                        styles.optionChipTextSelected,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>

          {category ===
            'Voetbal' && (
            <>
              <Text
                style={
                  styles.inputLabel
                }
              >
                Voetbaltype
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                style={{
                  marginBottom: 10,
                }}
              >
                {FOOTBALL_TYPES.map(
                  (type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.optionChip,
                        footballType ===
                          type &&
                          styles.optionChipSelected,
                      ]}
                      onPress={() =>
                        setFootballType(
                          type
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.optionChipText,
                          footballType ===
                            type &&
                            styles.optionChipTextSelected,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </ScrollView>
            </>
          )}

          <TouchableOpacity
            style={styles.saveButton}
            onPress={save}
          >
            <Text
              style={
                styles.saveButtonText
              }
            >
              Activiteit toevoegen
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* -------------------------------------------------------
   NAVIGATION
------------------------------------------------------- */

function NavButton({
  icon,
  label,
  active,
  onPress,
}) {
  return (
    <TouchableOpacity
      style={styles.navButton}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={23}
        color={
          active
            ? '#111827'
            : '#94a3b8'
        }
      />

      <Text
        style={[
          styles.navLabel,
          active &&
            styles.navLabelActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* -------------------------------------------------------
   APP
------------------------------------------------------- */

export default function App() {
  const [screen, setScreen] =
    useState('today');

  const [selectedDate, setSelectedDate] =
    useState(dateKey());

  const [events, setEvents] =
    useState([]);

  const [eventsLoaded, setEventsLoaded] =
    useState(false);

  const [profile, setProfile] =
    useState(DEFAULT_PROFILE);

  const [routine, setRoutine] =
    useState(DEFAULT_ROUTINE);

  const [food, setFood] = useState({
    date: dateKey(),
    meals: [],
    focus: [],
    note: '',
    water: false,
  });

  const [checkin, setCheckin] =
    useState({
      date: dateKey(),
      energy: 7,
      sleepQuality: 7,
      fatigue: 3,
    });

  const [addVisible, setAddVisible] =
    useState(false);

  const [
    profileVisible,
    setProfileVisible,
  ] = useState(false);

  const [
    foodModalVisible,
    setFoodModalVisible,
  ] = useState(false);

  /* LOAD */

  useEffect(() => {
    async function load() {
      try {
        const storedEvents =
          await AsyncStorage.getItem(
            EVENTS_STORAGE_KEY
          );

        const storedProfile =
          await AsyncStorage.getItem(
            PROFILE_STORAGE_KEY
          );

        const storedRoutine =
          await AsyncStorage.getItem(
            ROUTINE_STORAGE_KEY
          );

        const storedFood =
          await AsyncStorage.getItem(
            FOOD_STORAGE_KEY
          );

        const storedCheckin =
          await AsyncStorage.getItem(
            CHECKIN_STORAGE_KEY
          );

        if (storedEvents) {
          setEvents(
            JSON.parse(
              storedEvents
            )
          );
        }

        if (storedProfile) {
          setProfile(
            JSON.parse(
              storedProfile
            )
          );
        }

        if (storedRoutine) {
          setRoutine(
            JSON.parse(
              storedRoutine
            )
          );
        }

        if (storedFood) {
          const parsed =
            JSON.parse(
              storedFood
            );

          if (
            parsed.date ===
            dateKey()
          ) {
            setFood(parsed);
          }
        }

        if (storedCheckin) {
          const parsed =
            JSON.parse(
              storedCheckin
            );

          if (
            parsed.date ===
            dateKey()
          ) {
            setCheckin(parsed);
          }
        }
      } catch (error) {
        console.log(
          'Load error:',
          error
        );
      } finally {
        setEventsLoaded(true);
      }
    }

    load();
  }, []);

  /* SAVE EVENTS */

  useEffect(() => {
    if (!eventsLoaded) return;

    AsyncStorage.setItem(
      EVENTS_STORAGE_KEY,
      JSON.stringify(events)
    ).catch((error) =>
      console.log(
        'Save events error:',
        error
      )
    );
  }, [
    events,
    eventsLoaded,
  ]);

  /* SAVE PROFILE */

  useEffect(() => {
    AsyncStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify(profile)
    ).catch(() => {});
  }, [profile]);

  /* SAVE ROUTINE */

  useEffect(() => {
    AsyncStorage.setItem(
      ROUTINE_STORAGE_KEY,
      JSON.stringify(routine)
    ).catch(() => {});
  }, [routine]);

  /* SAVE FOOD */

  useEffect(() => {
    AsyncStorage.setItem(
      FOOD_STORAGE_KEY,
      JSON.stringify(food)
    ).catch(() => {});
  }, [food]);

  /* SAVE CHECKIN */

  useEffect(() => {
    AsyncStorage.setItem(
      CHECKIN_STORAGE_KEY,
      JSON.stringify(checkin)
    ).catch(() => {});
  }, [checkin]);

  const page = useMemo(() => {
    switch (screen) {
      case 'calendar':
        return (
          <CalendarScreen
            selectedDate={
              selectedDate
            }
            setSelectedDate={
              setSelectedDate
            }
            events={events}
            onAdd={() =>
              setAddVisible(true)
            }
          />
        );

      case 'football':
        return (
          <FootballScreen
            events={events}
            profile={profile}
            onEditProfile={() =>
              setProfileVisible(
                true
              )
            }
          />
        );

      case 'nutrition':
        return (
          <NutritionScreen
            food={food}
            setFood={setFood}
            profile={profile}
            routine={routine}
            events={events}
            checkin={checkin}
          />
        );

      case 'school':
        return (
          <SchoolScreen
            events={events}
            onAdd={() =>
              setAddVisible(true)
            }
          />
        );

      case 'ai':
        return (
          <AICoachScreen
            events={events}
            routine={routine}
            setRoutine={setRoutine}
            food={food}
            checkin={checkin}
            setCheckin={
              setCheckin
            }
          />
        );

      case 'today':
      default:
        return (
          <TodayScreen
            selectedDate={
              selectedDate
            }
            events={events}
            setEvents={setEvents}
            onAdd={() =>
              setAddVisible(true)
            }
            profile={profile}
          />
        );
    }
  }, [
    screen,
    selectedDate,
    events,
    profile,
    routine,
    food,
    checkin,
  ]);

  return (
    <SafeAreaView
      style={styles.container}
    >
      <View style={{ flex: 1 }}>
        {page}
      </View>

      <View
        style={styles.bottomNav}
      >
        <NavButton
          icon="today-outline"
          label="Vandaag"
          active={
            screen === 'today'
          }
          onPress={() =>
            setScreen('today')
          }
        />

        <NavButton
          icon="calendar-outline"
          label="Agenda"
          active={
            screen === 'calendar'
          }
          onPress={() =>
            setScreen('calendar')
          }
        />

        <NavButton
          icon="football-outline"
          label="Voetbal"
          active={
            screen === 'football'
          }
          onPress={() =>
            setScreen('football')
          }
        />

        <NavButton
          icon="restaurant-outline"
          label="Voeding"
          active={
            screen === 'nutrition'
          }
          onPress={() =>
            setScreen('nutrition')
          }
        />

        <NavButton
          icon="school-outline"
          label="School"
          active={
            screen === 'school'
          }
          onPress={() =>
            setScreen('school')
          }
        />

        <NavButton
          icon="sparkles-outline"
          label="AI"
          active={
            screen === 'ai'
          }
          onPress={() =>
            setScreen('ai')
          }
        />
      </View>

      <AddActivityModal
        visible={addVisible}
        onClose={() =>
          setAddVisible(false)
        }
        selectedDate={
          selectedDate
        }
        setEvents={setEvents}
      />

      <ProfileModal
        visible={
          profileVisible
        }
        onClose={() =>
          setProfileVisible(
            false
          )
        }
        profile={profile}
        setProfile={setProfile}
      />

      <FoodLogModal
        visible={
          foodModalVisible
        }
        onClose={() =>
          setFoodModalVisible(
            false
          )
        }
        food={food}
        setFood={setFood}
      />
    </SafeAreaView>
  );
}

/* -------------------------------------------------------
   STYLES
------------------------------------------------------- */

const styles = StyleSheet.create({
  nutritionAIHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 25,
    marginBottom: 10,
  },

  clearChatButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  nutritionAICard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  nutritionAIHero: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },

  nutritionAIIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  nutritionAITitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },

  nutritionAISubtitle: {
    color: '#cbd5e1',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },

  quickPromptWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 13,
  },

  quickPrompt: {
    backgroundColor: '#f1f5f9',
    borderRadius: 13,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },

  quickPromptText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '800',
  },

  chatMessages: {
    marginTop: 15,
    gap: 8,
  },

  chatBubble: {
    maxWidth: '90%',
    padding: 12,
    borderRadius: 16,
  },

  chatBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#111827',
    borderBottomRightRadius: 5,
  },

  chatBubbleAI: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    borderBottomLeftRadius: 5,
  },

  chatBubbleText: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 19,
  },

  chatBubbleTextUser: {
    color: '#fff',
  },

  aiTyping: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 12,
    paddingHorizontal: 4,
  },

  aiTypingText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },

  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 13,
  },

  chatInput: {
    flex: 1,
    minHeight: 46,
    maxHeight: 110,
    backgroundColor: '#f8fafc',
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    textAlignVertical: 'top',
  },

  chatSendButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },

  chatSendButtonDisabled: {
    opacity: 0.35,
  },

  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },

  scroll: {
    padding: 18,
    paddingBottom: 110,
  },

  hero: {
    backgroundColor: '#111827',
    borderRadius: 28,
    padding: 24,
    marginBottom: 14,
  },

  smallLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#94a3b8',
    marginBottom: 7,
  },

  heroTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: '#fff',
  },

  heroSub: {
    fontSize: 15,
    color: '#cbd5e1',
    marginTop: 5,
  },

  profileMini: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 17,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  profileName: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
  },

  profileGoal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    maxWidth: 150,
    textAlign: 'right',
  },

  muted: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 13,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 3,
  },

  pageTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#111827',
  },

  pageSub: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
  },

  addButton: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  addButtonText: {
    color: '#fff',
    fontWeight: '800',
  },

  circleAdd: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },

  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  completedCard: {
    opacity: 0.55,
  },

  timeBox: {
    width: 62,
  },

  timeText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111827',
  },

  activityTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },

  completedText: {
    textDecorationLine: 'line-through',
  },

  activitySub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
  },

  progressCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 17,
    marginBottom: 12,
  },

  progressNumber: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '900',
    marginTop: 4,
  },

  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111827',
    marginTop: 10,
  },

  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 5,
    lineHeight: 19,
  },

  dayPill: {
    width: 62,
    paddingVertical: 11,
    borderRadius: 18,
    backgroundColor: '#fff',
    marginRight: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  dayPillSelected: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },

  dayPillTop: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },

  dayPillNumber: {
    fontSize: 21,
    fontWeight: '900',
    color: '#111827',
    marginTop: 2,
  },

  dayPillSelectedText: {
    color: '#fff',
  },

  selectedDateCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  calendarEvent: {
    backgroundColor: '#fff',
    borderRadius: 17,
    padding: 15,
    marginBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  calendarTime: {
    width: 60,
    fontWeight: '900',
    color: '#111827',
  },

  calendarTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },

  playerCard: {
    backgroundColor: '#111827',
    borderRadius: 25,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  playerPosition: {
    color: '#fff',
    fontSize: 27,
    fontWeight: '900',
  },

  playerClub: {
    color: '#cbd5e1',
    marginTop: 2,
  },

  profileDetails: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 17,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    gap: 15,
  },

  infoLabel: {
    color: '#64748b',
    fontWeight: '700',
  },

  infoValue: {
    color: '#111827',
    fontWeight: '800',
    flex: 1,
    textAlign: 'right',
  },

  outlineButton: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 13,
    padding: 11,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  outlineButtonText: {
    fontWeight: '800',
    color: '#111827',
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginBottom: 12,
  },

  statBox: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  statValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
  },

  statLabel: {
    color: '#64748b',
    marginTop: 3,
    fontWeight: '700',
  },

  loadCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  loadNumber: {
    fontSize: 38,
    fontWeight: '900',
    color: '#111827',
    marginTop: 2,
  },

  loadIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  nextCard: {
    backgroundColor: '#e2e8f0',
    borderRadius: 20,
    padding: 18,
    marginBottom: 22,
  },

  nextTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
    marginTop: 5,
  },

  nextSub: {
    color: '#475569',
    marginTop: 4,
  },

  developmentCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  developmentIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  developmentTitle: {
    fontWeight: '900',
    fontSize: 16,
    color: '#111827',
  },

  developmentText: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },

  fuelHero: {
    backgroundColor: '#111827',
    borderRadius: 26,
    padding: 22,
    marginBottom: 22,
  },

  fuelScore: {
    color: '#fff',
    fontSize: 62,
    fontWeight: '900',
    marginTop: 3,
  },

  fuelScoreLabel: {
    color: '#94a3b8',
    fontWeight: '800',
    position: 'absolute',
    left: 98,
    top: 63,
  },

  fuelText: {
    color: '#cbd5e1',
    lineHeight: 19,
    marginTop: 7,
  },

  foodRow: {
    backgroundColor: '#fff',
    borderRadius: 17,
    padding: 15,
    marginBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  foodRowChecked: {
    borderColor: '#86efac',
  },

  foodTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111827',
  },

  foodExample: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
  },

  focusChip: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 13,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  focusChipSelected: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },

  focusChipText: {
    color: '#64748b',
    fontWeight: '700',
  },

  focusChipTextSelected: {
    color: '#111827',
  },

  foodNoteCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 17,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  textArea: {
    backgroundColor: '#f8fafc',
    borderRadius: 13,
    padding: 13,
    minHeight: 90,
    marginTop: 9,
    color: '#111827',
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  waterButton: {
    backgroundColor: '#f8fafc',
    borderRadius: 13,
    padding: 12,
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  waterButtonSelected: {
    backgroundColor: '#f1f5f9',
  },

  waterText: {
    flex: 1,
    color: '#111827',
    fontWeight: '700',
    fontSize: 12,
  },

  tipCard: {
    backgroundColor: '#e2e8f0',
    borderRadius: 18,
    padding: 15,
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },

  tipText: {
    flex: 1,
    color: '#334155',
    lineHeight: 18,
    fontSize: 12,
  },

  schoolHero: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  schoolHeroTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
  },

  schoolHeroText: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },

  schoolDate: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  schoolDateDay: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
  },

  schoolDateMonth: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
  },

  aiHero: {
    backgroundColor: '#111827',
    borderRadius: 25,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },

  aiIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  aiHeroTitle: {
    color: '#fff',
    fontSize: 21,
    fontWeight: '900',
  },

  aiHeroText: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },

  checkinCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 17,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 7,
  },

  scoreLabel: {
    color: '#111827',
    fontWeight: '800',
  },

  scoreValue: {
    color: '#64748b',
    fontWeight: '800',
  },

  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  scoreCircle: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  scoreCircleActive: {
    backgroundColor: '#111827',
  },

  scoreCircleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
  },

  scoreCircleTextActive: {
    color: '#fff',
  },

  routineCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 17,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  editSmall: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  generateButton: {
    backgroundColor: '#111827',
    borderRadius: 17,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginBottom: 23,
  },

  generateText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 15,
  },

  planItem: {
    backgroundColor: '#fff',
    borderRadius: 17,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  planTime: {
    width: 55,
  },

  planTimeText: {
    fontWeight: '900',
    color: '#111827',
    fontSize: 13,
  },

  planDot: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  planTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111827',
  },

  planSub: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },

  aiDisclaimer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 15,
    padding: 13,
  },

  aiDisclaimerText: {
    flex: 1,
    color: '#64748b',
    fontSize: 11,
    lineHeight: 16,
  },

  inputLabel: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },

  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 13,
    padding: 13,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 14,
  },

  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },

  optionChipSelected: {
    backgroundColor: '#111827',
  },

  optionChipText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '800',
  },

  optionChipTextSelected: {
    color: '#fff',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor:
      'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },

  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '92%',
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },

  modalTitle: {
    fontSize: 23,
    fontWeight: '900',
    color: '#111827',
  },

  saveButton: {
    backgroundColor: '#111827',
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
    marginTop: 4,
  },

  saveButtonText: {
    color: '#fff',
    fontWeight: '900',
  },

  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 76,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 6,
  },

  navButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '16.66%',
  },

  navLabel: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '700',
    marginTop: 3,
  },

  navLabelActive: {
    color: '#111827',
  },
});
