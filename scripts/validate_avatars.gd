extends SceneTree
## Headless: avatar assets + Game.set_avatar smoke.


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	print("[avatar] boot")
	var game = root.get_node_or_null("Game")
	if game == null:
		push_error("[avatar] Game missing")
		quit(1)
		return

	for i in game.AVATAR_COUNT:
		var path: String = game.avatar_path(i)
		if not ResourceLoader.exists(path) and not FileAccess.file_exists(path):
			push_error("[avatar] missing %s" % path)
			quit(1)
			return
		var tex: Texture2D = game.avatar_texture(i)
		if tex == null:
			push_error("[avatar] texture null id=%d" % i)
			quit(1)
			return

	game.set_avatar(3)
	if int(game.avatar_id) != 3:
		push_error("[avatar] set_avatar failed")
		quit(1)
		return
	game.set_avatar(0)
	print("[avatar] ok count=", game.AVATAR_COUNT)
	quit(0)
