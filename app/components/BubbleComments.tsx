import React from "react";

// Puedes cambiar estos links por tus propios avatares cuando quieras
const avatars = [
  "https://randomuser.me/api/portraits/women/44.jpg",
  "https://randomuser.me/api/portraits/men/32.jpg",
  "https://randomuser.me/api/portraits/men/54.jpg",
  "https://randomuser.me/api/portraits/women/68.jpg",
];
export default function BubbleComments({ comments }: { comments: any[] }) {
  return (
    <div className="bubble-comments">
      {comments.map((comment: any, idx: number) => (
        <div
          key={idx}
          className="bubble-comment"
        >
          <img
            src={avatars[idx % avatars.length]}
            alt="avatar"
            className="bubble-avatar"
          />
          <div className="bubble-text">
            {comment.text}
          </div>
        </div>
      ))}
    </div>
  );
}
