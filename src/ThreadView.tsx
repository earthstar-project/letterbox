import * as React from "react";
import { Document, isErr } from "earthstar";
import { Link, Outlet, useMatch, useParams } from "react-router-dom";
import {
  getDocPublishedTimestamp,
  Post,
  ThreadRoot,
  useLetterboxLayer,
} from "./letterbox-layer";
import { formatRelative } from "date-fns";
import { AuthorLabel, useCurrentAuthor } from "react-earthstar";
import { renderMarkdown } from "./util/markdown";
import ThreadTitle from "./ThreadTitle";
import MarkdownPreview from "./MarkdownPreview";

function ThreadBar({ id }: { id: string }) {
  const match = useMatch("/:lookup/*");

  const lookup = match?.params.lookup;

  const letterboxLayer = useLetterboxLayer();

  const lastThreadItem = letterboxLayer.lastThreadItem(id);

  const mostRecentIsUnread = lastThreadItem
    ? letterboxLayer.isUnread(
      id,
      getDocPublishedTimestamp(lastThreadItem.doc),
    )
    : true;

  const nowTimestamp = Date.now() * 1000;

  return <div
    className="flex py-2 px-3 md:px-3 bg-gray-100 border-b shadow-sm justify-between sticky top-0 z-50 items-baseline"
  >
    <div className="flex">
      <Link
        className="md:hidden mr-2 text-blue-500 text-xl"
        to={`/${lookup}` || "/"}
      >
        ⬅
      </Link>
      <div className={"font-bold text-xl"}>
        <ThreadTitle threadId={id} />
      </div>
    </div>

    {mostRecentIsUnread
      ? <button
        className="p-1.5 bg-blue-800 text-white rounded"
        onClick={() => letterboxLayer.markReadUpTo(id, nowTimestamp)}
      >
        Mark thread as read
      </button>
      : null}
  </div>;
}

function PostDetails(
  { post, threadId, onEdit, isEditing }: {
    post: Post | ThreadRoot;
    threadId: string;
    onEdit: () => void;
    isEditing: boolean;
  },
) {
  const letterBoxLayer = useLetterboxLayer();
  const firstPostedTimestamp = getDocPublishedTimestamp(post.doc);
  const isUnread = letterBoxLayer.isUnread(threadId, firstPostedTimestamp);
  const [currentAuthor] = useCurrentAuthor();

  const isOwnPost = currentAuthor?.address === post.doc.author;

  return <div className={"text-gray-500 flex justify-between items-baseline"}>
    <div className="flex items-baseline gap-1">
      <b>
        <AuthorLabel address={post.doc.author} />
      </b>{" "}
      {formatRelative(post.firstPosted, Date.now())}
      {isOwnPost
        ? <button
          className={isEditing ? "text-red-600" : "text-blue-500"}
          onClick={onEdit}
        >
          {isEditing ? "Cancel edit" : "Edit"}
        </button>
        : null}
    </div>
    <div>
      {currentAuthor
        ? <label>
          <span className="text-sm">Read</span>
          <input
            type="checkbox"
            className="ml-1"
            checked={!isUnread}
            onChange={() => {
              if (isUnread) {
                letterBoxLayer.markReadUpTo(threadId, firstPostedTimestamp);
              } else {
                letterBoxLayer.markReadUpTo(threadId, firstPostedTimestamp - 1);
              }
            }}
          />
        </label>
        : null}
    </div>
  </div>;
}

function PostEditForm(
  { doc, onEdit }: { doc: Document; onEdit: () => void },
) {
  const [content, setContent] = React.useState(doc.content);

  const letterboxLayer = useLetterboxLayer();

  const publishedTimestamp = getDocPublishedTimestamp(doc);

  return <form
    className="flex flex-col mt-3"
    onSubmit={(e) => {
      e.preventDefault();

      const res = letterboxLayer.editPost(publishedTimestamp, content);

      if (!isErr(res)) {
        onEdit();
      } else {
        alert("Something went wrong editing this post!");
      }
    }}
  >
    <textarea
      value={content}
      className="border p-2 mb-2 shadow-inner"
      onChange={(e) => {
        setContent(e.target.value);
      }}
      rows={10}
    />
    <MarkdownPreview raw={content} />
    <button className="btn mt-1" type="submit">Edit post</button>
  </form>;
}

function ThreadRootView({ root }: { root: ThreadRoot }) {
  const letterBoxLayer = useLetterboxLayer();
  const firstPostedTimestamp = getDocPublishedTimestamp(root.doc);
  const isUnread = letterBoxLayer.isUnread(root.id, firstPostedTimestamp);

  const [isEditing, setIsEditing] = React.useState(false);

  return <article
    className={`p-3 md:p-6  ${isUnread ? "" : "bg-gray-100 text-gray-600"}`}
  >
    <PostDetails
      isEditing={isEditing}
      onEdit={() => setIsEditing((prev) => !prev)}
      post={root}
      threadId={root.id}
    />
    {isEditing
      ? <PostEditForm onEdit={() => setIsEditing(false)} doc={root.doc} />
      : <PostContent doc={root.doc} />}
  </article>;
}

function PostView({ post, threadId }: { post: Post; threadId: string }) {
  const letterBoxLayer = useLetterboxLayer();
  const firstPostedTimestamp = getDocPublishedTimestamp(post.doc);
  const isUnread = letterBoxLayer.isUnread(threadId, firstPostedTimestamp);

  const [isEditing, setIsEditing] = React.useState(false);

  return <article
    className={`p-3 md:p-6 ${isUnread ? "" : "bg-gray-100 text-gray-600"}`}
  >
    <PostDetails
      isEditing={isEditing}
      onEdit={() => setIsEditing((prev) => !prev)}
      post={post}
      threadId={threadId}
    />
    {isEditing
      ? <PostEditForm onEdit={() => setIsEditing(false)} doc={post.doc} />
      : <PostContent doc={post.doc} />}
  </article>;
}

function PostContent({ doc }: { doc: Document }) {
  return <div>
    {renderMarkdown(doc.content)}
  </div>;
}

export default function ThreadView() {
  const { authorPubKey, timestamp } = useParams();

  const [currentAuthor] = useCurrentAuthor();

  const letterboxLayer = useLetterboxLayer();

  const threadId = `${authorPubKey}/${timestamp}`;
  const thread = letterboxLayer.getThread(threadId);

  if (!thread) {
    return <p>No thread found.</p>;
  }

  return <div className="overflow-scroll shadow-lg">
    <ThreadBar id={thread.root.id} />
    <ol>
      <ThreadRootView root={thread.root} />
      <hr className="border-gray-300" />
      {thread.replies.map((post) =>
        <React.Fragment key={post.doc.path}>
          <PostView post={post} threadId={thread.root.id} />
          <hr className="border-gray-300" />
        </React.Fragment>
      )}
    </ol>
    <footer className="flex gap-2 p-3 lg:px-6 justify-between py-3">
      {currentAuthor
        ? <Link className="link-btn" to={"reply"}>New reply</Link>
        : null}
    </footer>
    <Outlet />
  </div>;
}
