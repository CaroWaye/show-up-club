// Built-in muscle groups and exercises. Re-applied on every start with
// INSERT OR IGNORE, so adding to this list later shows up without a reset.
export const MUSCLE_GROUPS = [
  {
    slug: 'chest',
    name: 'Chest',
    exercises: {
      calisthenics: ['Push-Up', 'Incline Push-Up', 'Decline Push-Up', 'Wide Push-Up', 'Archer Push-Up', 'Chest Dip'],
      weights: [
        'Barbell Bench Press', 'Incline Barbell Bench Press', 'Dumbbell Bench Press', 'Incline Dumbbell Press',
        'Dumbbell Fly', 'Cable Crossover', 'Pec Deck', 'Machine Chest Press',
      ],
    },
  },
  {
    slug: 'back',
    name: 'Back',
    exercises: {
      calisthenics: ['Pull-Up', 'Chin-Up', 'Inverted Row', 'Scapular Pull-Up', 'Superman', 'Back Extension'],
      weights: [
        'Deadlift', 'Barbell Row', 'Single-Arm Dumbbell Row', 'Lat Pulldown', 'Seated Cable Row',
        'T-Bar Row', 'Straight-Arm Pulldown', 'Barbell Shrug',
      ],
    },
  },
  {
    slug: 'shoulders',
    name: 'Shoulders',
    exercises: {
      calisthenics: ['Pike Push-Up', 'Handstand Hold', 'Handstand Push-Up', 'Wall Walk'],
      weights: [
        'Overhead Press', 'Dumbbell Shoulder Press', 'Arnold Press', 'Lateral Raise', 'Front Raise',
        'Rear Delt Fly', 'Face Pull', 'Upright Row',
      ],
    },
  },
  {
    slug: 'biceps',
    name: 'Biceps',
    exercises: {
      calisthenics: ['Close-Grip Chin-Up', 'Ring Bicep Curl'],
      weights: [
        'Barbell Curl', 'EZ-Bar Curl', 'Dumbbell Curl', 'Hammer Curl', 'Preacher Curl',
        'Incline Dumbbell Curl', 'Cable Curl', 'Concentration Curl',
      ],
    },
  },
  {
    slug: 'triceps',
    name: 'Triceps',
    exercises: {
      calisthenics: ['Bench Dip', 'Diamond Push-Up', 'Parallel Bar Dip', 'Bodyweight Tricep Extension'],
      weights: ['Tricep Pushdown', 'Overhead Tricep Extension', 'Skull Crusher', 'Close-Grip Bench Press', 'Tricep Kickback'],
    },
  },
  {
    slug: 'core',
    name: 'Core',
    exercises: {
      calisthenics: [
        'Plank', 'Side Plank', 'Hollow Body Hold', 'Dead Bug', 'Crunch', 'Bicycle Crunch', 'Lying Leg Raise',
        'Hanging Knee Raise', 'Hanging Leg Raise', 'L-Sit', 'V-Up', 'Mountain Climber', 'Russian Twist',
        'Ab Wheel Rollout', 'Dragon Flag',
      ],
      weights: ['Cable Crunch', 'Pallof Press', 'Cable Woodchopper', 'Weighted Decline Sit-Up'],
    },
  },
  {
    slug: 'glutes',
    name: 'Glutes',
    exercises: {
      calisthenics: [
        'Glute Bridge', 'Single-Leg Glute Bridge', 'Frog Pump', 'Donkey Kick', 'Fire Hydrant', 'Clamshell', 'Curtsy Lunge',
      ],
      weights: ['Barbell Hip Thrust', 'Dumbbell Hip Thrust', 'Cable Kickback', 'Hip Abduction Machine', 'Sumo Deadlift'],
    },
  },
  {
    slug: 'quads',
    name: 'Quads',
    exercises: {
      calisthenics: [
        'Air Squat', 'Jump Squat', 'Pistol Squat', 'Walking Lunge', 'Reverse Lunge', 'Bulgarian Split Squat',
        'Step-Up', 'Wall Sit', 'Sissy Squat',
      ],
      weights: [
        'Back Squat', 'Front Squat', 'Goblet Squat', 'Leg Press', 'Leg Extension', 'Hack Squat',
        'Smith Machine Squat', 'Dumbbell Lunge',
      ],
    },
  },
  {
    slug: 'hamstrings',
    name: 'Hamstrings',
    exercises: {
      calisthenics: ['Nordic Curl', 'Sliding Leg Curl', 'Single-Leg RDL'],
      weights: ['Romanian Deadlift', 'Stiff-Leg Deadlift', 'Lying Leg Curl', 'Seated Leg Curl', 'Good Morning'],
    },
  },
  {
    slug: 'calves',
    name: 'Calves',
    exercises: {
      calisthenics: ['Calf Raise', 'Single-Leg Calf Raise', 'Pogo Hops'],
      weights: ['Standing Calf Raise Machine', 'Seated Calf Raise', 'Leg Press Calf Raise'],
    },
  },
  {
    slug: 'full-body',
    name: 'Full Body',
    exercises: {
      calisthenics: ['Burpee', 'Muscle-Up', 'Bear Crawl', 'Inchworm', 'Jumping Jack'],
      weights: ['Kettlebell Swing', 'Clean and Press', 'Power Clean', 'Thruster', 'Turkish Get-Up', "Farmer's Carry"],
    },
  },
  {
    slug: 'cardio',
    name: 'Cardio',
    exercises: {
      cardio: [
        'Treadmill Run', 'Incline Walk', 'Outdoor Run', 'StairMaster', 'Rowing Machine', 'Stationary Bike',
        'Elliptical', 'Jump Rope', 'Assault Bike', 'Sled Push', 'HIIT Circuit', 'Swimming',
      ],
    },
  },
];
