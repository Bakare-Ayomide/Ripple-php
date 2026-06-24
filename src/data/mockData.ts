import post1 from "@/assets/post1.jpg";
import post2 from "@/assets/post2.jpg";
import post3 from "@/assets/post3.jpg";
import post4 from "@/assets/post4.jpg";
import post5 from "@/assets/post5.jpg";
import post6 from "@/assets/post6.jpg";

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio?: string;
  followers: number;
  following: number;
  posts: number;
  isFollowing?: boolean;
  hasStory?: boolean;
}

export interface Post {
  id: string;
  user: User;
  image: string;
  caption: string;
  likes: number;
  comments: number;
  timeAgo: string;
  isLiked: boolean;
  isSaved: boolean;
}

export const currentUser: User = {
  id: "1",
  username: "you",
  displayName: "Your Name",
  avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=you",
  bio: "✨ Living my best life | 📸 Photography enthusiast",
  followers: 1243,
  following: 567,
  posts: 48,
};

export const users: User[] = [
  { id: "2", username: "sarah.designs", displayName: "Sarah Chen", avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=sarah", followers: 12400, following: 890, posts: 234, hasStory: true },
  { id: "3", username: "wanderlust_mike", displayName: "Mike Torres", avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=mike", followers: 8900, following: 432, posts: 156, hasStory: true },
  { id: "4", username: "minimal.home", displayName: "Aria Patel", avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=aria", followers: 45000, following: 210, posts: 89, hasStory: true },
  { id: "5", username: "foodie_adventures", displayName: "Leo Kim", avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=leo", followers: 23000, following: 678, posts: 312, hasStory: false },
  { id: "6", username: "peak_chaser", displayName: "Emma Brooks", avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=emma", followers: 67000, following: 345, posts: 198, hasStory: true },
  { id: "7", username: "goldenboy_max", displayName: "Jake Wilson", avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=jake", followers: 15600, following: 234, posts: 76, hasStory: true },
  { id: "8", username: "urban_lens", displayName: "Nora Ali", avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=nora", followers: 9800, following: 567, posts: 145, hasStory: false },
];

export const posts: Post[] = [
  {
    id: "p1", user: users[0], image: post1,
    caption: "Coffee and contemplation ☕ Nothing beats a quiet morning at my favorite spot.",
    likes: 1284, comments: 42, timeAgo: "2h", isLiked: false, isSaved: false,
  },
  {
    id: "p2", user: users[1], image: post2,
    caption: "Found paradise 🌊 This is what dreams are made of.",
    likes: 3891, comments: 128, timeAgo: "4h", isLiked: true, isSaved: true,
  },
  {
    id: "p3", user: users[2], image: post3,
    caption: "When the light hits just right 🏡 Our latest project is finally complete.",
    likes: 7623, comments: 89, timeAgo: "6h", isLiked: false, isSaved: false,
  },
  {
    id: "p4", user: users[3], image: post4,
    caption: "Street food is an art form 🍜 Every bite tells a story.",
    likes: 2156, comments: 67, timeAgo: "8h", isLiked: false, isSaved: false,
  },
  {
    id: "p5", user: users[4], image: post5,
    caption: "Above the clouds ⛰️ 4AM wake up was worth every second.",
    likes: 12400, comments: 234, timeAgo: "12h", isLiked: true, isSaved: false,
  },
  {
    id: "p6", user: users[5], image: post6,
    caption: "Max says hi! 🐕 Best photo session ever.",
    likes: 5678, comments: 156, timeAgo: "1d", isLiked: false, isSaved: false,
  },
];

export const suggestedUsers: User[] = [
  { id: "9", username: "travel_diaries", displayName: "Mia Zhang", avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=mia", followers: 34000, following: 456, posts: 267, isFollowing: false },
  { id: "10", username: "plant_parent", displayName: "Oliver Hart", avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=oliver", followers: 18000, following: 321, posts: 134, isFollowing: false },
  { id: "11", username: "sunset_chaser", displayName: "Luna Rivera", avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=luna", followers: 52000, following: 189, posts: 298, isFollowing: false },
];
