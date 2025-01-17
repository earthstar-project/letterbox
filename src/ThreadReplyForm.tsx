import { isErr } from "earthstar";
import * as React from "react";
import { useIdentity } from "react-earthstar";
import { useNavigate, useParams } from "react-router-dom";
import { useDebouncedCallback } from "use-debounce";
import MarkdownPreview from "./MarkdownPreview";
import { useIsCacheHeated } from "./util/use-cache-heated";
import { useLetterboxLayer } from "./util/use-letterbox-layer";

export default function ThreadReplyForm() {
  const { authorPubKey, timestamp } = useParams();

  const timestampInt = parseInt(timestamp || "0");
  const threadAuthorPubKey = authorPubKey || "";

  const [currentAuthor] = useIdentity();
  const letterboxLayer = useLetterboxLayer();
  const [replyText, setReplyText] = React.useState(
    "",
  );
  const navigate = useNavigate();
  const [didSaveDraft, setDidSaveDraft] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement | null>(null);

  React.useLayoutEffect(() => {
    if (formRef.current) {
      formRef.current.scrollIntoView({ block: "end" });
    }
  }, []);

  const draft = letterboxLayer.getReplyDraft(timestampInt, threadAuthorPubKey);

  const draftIsHeated = useIsCacheHeated(draft);

  React.useEffect(() => {
    if (draftIsHeated && draft) {
      setReplyText(draft);
    }
  }, [draftIsHeated]);

  const writeDraft = useDebouncedCallback((content) => {
    letterboxLayer.setReplyDraft(timestampInt, threadAuthorPubKey, content);

    setDidSaveDraft(true);
  }, 1000);

  return (
    <form
      ref={formRef}
      className={"flex flex-col pt-0 p-3 lg:p-6 lg:pt-0"}
      onSubmit={async (e) => {
        e.preventDefault();

        const result = await letterboxLayer.createReply(
          timestampInt,
          threadAuthorPubKey,
          replyText,
        );

        if (isErr(result)) {
          alert("Something went wrong with creating this reply.");
        } else {
          letterboxLayer.clearReplyDraft(timestampInt, threadAuthorPubKey);
        }

        navigate("..");
      }}
    >
      <textarea
        required
        className={"border p-2 mb-2 shadow-inner dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"}
        value={replyText}
        placeholder={"Supports markdown"}
        rows={10}
        onChange={(e) => {
          setDidSaveDraft(false);
          setReplyText(e.target.value);
          writeDraft(e.target.value);
        }}
      />
      <div
        className={`text-right text-gray-500 dark:text-gray-400 ${
          didSaveDraft ? "visible" : "invisible"
        }`}
      >
        ✔ Draft saved
      </div>

      <MarkdownPreview raw={replyText} />

      <button disabled={!currentAuthor} className={"btn mt-2"} type={"submit"}>
        Post reply
      </button>
    </form>
  );
}
