import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  Bug,
  ChevronRight,
  ImageIcon,
  LoaderCircle,
  Plus,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createAlbumGroup,
  listAlbumGroups,
  listPhotosByGroup,
} from "@/lib/db";
import { generateNote, LLMError, type LLMConfig } from "@/lib/llm";
import type { AlbumGroup, Photo } from "@/types/database";

const REAL_LLM_CONFIG: LLMConfig = {
  endpoint: "http://127.0.0.1:15721/v1/chat/completions",
  apiKey: "CC Switch key",
  model: "deepseek-chat",
  useMock: false,
};

const MOCK_LLM_CONFIG: LLMConfig = {
  endpoint: "https://any.example/v1/chat/completions",
  apiKey: "",
  model: "deepseek-chat",
  useMock: true,
};

async function testLlmMock() {
  try {
    const res = await generateNote(
      "猫咪",
      ["黄猫蹲窗边", "三花舔爪子"],
      MOCK_LLM_CONFIG,
    );
    console.log("✅ 返回结果：", res);
  } catch (e) {
    console.error("❌ 报错：", e);
  }
}

async function testLlmReal() {
  try {
    const res = await generateNote(
      "猫咪",
      ["黄猫蹲窗边", "三花舔爪子"],
      REAL_LLM_CONFIG,
    );
    console.log("✅【CCSwitch + DeepSeek】", res);
  } catch (e) {
    if (e instanceof LLMError) {
      console.error("❌【LLMError】", e.message);
    } else {
      console.error("❌", e);
    }
  }
}

function App() {
  const [groups, setGroups] = useState<AlbumGroup[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<AlbumGroup | null>(null);
  const [groupPhotos, setGroupPhotos] = useState<Photo[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isGeneratingNote, setIsGeneratingNote] = useState(false);
  const [generatedNote, setGeneratedNote] = useState<{
    title: string;
    content: string;
    tags: string[];
  } | null>(null);
  const groupNameInputRef = useRef<HTMLInputElement>(null);

  const loadGroups = useCallback(async () => {
    setIsLoadingGroups(true);

    try {
      const nextGroups = await listAlbumGroups();
      setGroups(nextGroups);
    } catch (error) {
      console.error("[album-groups] Failed to load groups:", error);
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsLoadingGroups(false);
    }
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    if (isCreateOpen) {
      groupNameInputRef.current?.focus();
    }
  }, [isCreateOpen]);

  function openCreateDialog() {
    setErrorMessage(null);
    setIsDebugOpen(false);
    setGroupName("");
    setIsCreateOpen(true);
  }

  function closeCreateDialog() {
    if (isCreating) {
      return;
    }

    setIsCreateOpen(false);
    setErrorMessage(null);
  }

  async function handleCreateGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = groupName.trim();

    if (!name) {
      setErrorMessage("请输入分组名称");
      return;
    }

    setIsCreating(true);
    setErrorMessage(null);

    try {
      const group = await createAlbumGroup({ name });
      console.info("[album-groups] Created group:", group);
      setIsCreateOpen(false);
      setGroupName("");
      await loadGroups();
    } catch (error) {
      console.error("[album-groups] Failed to create group:", error);
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsCreating(false);
    }
  }

  async function openGroup(group: AlbumGroup) {
    setSelectedGroup(group);
    setGroupPhotos([]);
    setGeneratedNote(null);
    setErrorMessage(null);
    setIsDebugOpen(false);
    setIsLoadingPhotos(true);

    try {
      const photos = await listPhotosByGroup(group.id);
      setGroupPhotos(photos);
    } catch (error) {
      console.error("[album-group] Failed to load photos:", error);
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsLoadingPhotos(false);
    }
  }

  function closeGroup() {
    setSelectedGroup(null);
    setGroupPhotos([]);
    setGeneratedNote(null);
    setErrorMessage(null);
    setIsDebugOpen(false);
  }

  async function handleGenerateNote() {
    if (!selectedGroup) {
      return;
    }

    setIsGeneratingNote(true);
    setErrorMessage(null);

    try {
      const captions = groupPhotos
        .map((photo) => photo.fileName?.trim() || "")
        .filter(Boolean);
      const note = await generateNote(
        selectedGroup.name,
        captions,
        REAL_LLM_CONFIG,
      );
      console.info("[album-group] Generated note:", note);
      setGeneratedNote(note);
    } catch (error) {
      console.error("[album-group] Failed to generate note:", error);
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsGeneratingNote(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
        <header className="flex items-center justify-between border-b px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex min-w-0 items-center gap-2">
            {selectedGroup ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="返回分组列表"
                onClick={closeGroup}
              >
                <ArrowLeft />
              </Button>
            ) : null}
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                {selectedGroup ? "GROUP" : "PHOTO NOTE"}
              </p>
              <h1 className="truncate text-lg font-semibold">
                {selectedGroup?.name ?? "照片笔记"}
              </h1>
            </div>
          </div>

          <div className="relative">
            <Button
              type="button"
              variant={isDebugOpen ? "secondary" : "ghost"}
              size="icon"
              aria-label="打开开发调试"
              aria-expanded={isDebugOpen}
              onClick={() => setIsDebugOpen((open) => !open)}
            >
              <Settings2 />
            </Button>

            {isDebugOpen ? (
              <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg">
                <div className="mb-2 flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
                  <Bug className="size-3.5" />
                  开发调试
                </div>
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => void testLlmReal()}
                  >
                    Test LLM Real
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => void testLlmMock()}
                  >
                    Test LLM Mock
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-4 p-4">
          {errorMessage ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {errorMessage}
            </div>
          ) : null}

          {selectedGroup ? (
            <>
              <section className="flex flex-1 flex-col">
                <div className="mb-4 flex items-end justify-between gap-3 border-b pb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{selectedGroup.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(selectedGroup.createdAt)}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {groupPhotos.length} 张图片
                  </p>
                </div>

                {isLoadingPhotos ? (
                  <div className="flex flex-1 items-center justify-center text-muted-foreground">
                    <LoaderCircle className="mr-2 size-4 animate-spin" />
                    加载图片
                  </div>
                ) : groupPhotos.length > 0 ? (
                  <ul className="space-y-2">
                    {groupPhotos.map((photo) => (
                      <li
                        key={photo.id}
                        className="truncate rounded-lg border bg-card px-4 py-3 text-sm text-card-foreground"
                      >
                        {photo.fileName || "未命名图片"}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed bg-muted/30 p-6 text-sm text-muted-foreground">
                    暂无图片
                  </div>
                )}

                {generatedNote ? (
                  <article className="mt-4 rounded-lg border bg-card p-4 text-card-foreground">
                    <h2 className="text-base font-semibold">
                      {generatedNote.title}
                    </h2>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {generatedNote.content}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {generatedNote.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </article>
                ) : null}
              </section>

              <Button
                id="generate-note-button"
                className="w-full"
                size="lg"
                onClick={() => void handleGenerateNote()}
                disabled={isGeneratingNote}
              >
                {isGeneratingNote ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <Sparkles />
                )}
                生成小红书文案
              </Button>
            </>
          ) : (
            <>
              <section className="flex flex-1 flex-col">
                {isLoadingGroups ? (
                  <div className="flex flex-1 items-center justify-center text-muted-foreground">
                    <LoaderCircle className="mr-2 size-4 animate-spin" />
                    加载中
                  </div>
                ) : groups.length > 0 ? (
                  <ul className="space-y-2">
                    {groups.map((group) => (
                      <li key={group.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 rounded-lg border bg-card px-4 py-3 text-left text-card-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                          onClick={() => void openGroup(group)}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{group.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatDate(group.createdAt)}
                            </p>
                          </div>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed bg-muted/30 p-6">
                    <div className="flex max-w-xs flex-col items-center text-center">
                      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <ImageIcon className="size-5" />
                      </div>
                      <h2 className="text-sm font-medium">暂无分组</h2>
                    </div>
                  </div>
                )}
              </section>

              <Button
                id="new-group-button"
                className="w-full"
                size="lg"
                onClick={openCreateDialog}
                disabled={isCreating}
              >
                <Plus />
                新建
              </Button>
            </>
          )}
        </main>
      </div>

      {isCreateOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-group-title"
            className="w-full max-w-sm rounded-lg border bg-background p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="create-group-title" className="text-base font-semibold">
                新建分组
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="关闭"
                onClick={closeCreateDialog}
                disabled={isCreating}
              >
                <X />
              </Button>
            </div>

            <form className="space-y-4" onSubmit={handleCreateGroup}>
              <div className="space-y-2">
                <label htmlFor="group-name-input" className="text-sm font-medium">
                  分组名称
                </label>
                <input
                  ref={groupNameInputRef}
                  id="group-name-input"
                  name="name"
                  value={groupName}
                  onChange={(event) => setGroupName(event.currentTarget.value)}
                  placeholder="例如：周末旅行"
                  autoComplete="off"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  disabled={isCreating}
                />
              </div>

              {errorMessage ? (
                <p className="text-sm text-destructive" role="alert">
                  {errorMessage}
                </p>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeCreateDialog}
                  disabled={isCreating}
                >
                  取消
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? (
                    <LoaderCircle className="animate-spin" />
                  ) : null}
                  创建
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "操作失败，请稍后重试";
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default App;
