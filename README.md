# rbxts-transformer-private
Adds a custom prefix to the private fields/methods in the compiled code for the sake of usage in Luau.

```ts
class foo {
	private bar = 5;
	private buzz() {}

	private fuzz() {
		this.bar = 6;
		this.buzz();
	}
}
```

```lua
-- Compiled with roblox-ts v2.3.0
local foo
do
	foo = setmetatable({}, {
		__tostring = function()
			return "foo"
		end,
	})
	foo.__index = foo
	function foo.new(...)
		local self = setmetatable({}, foo)
		return self:constructor(...) or self
	end
	function foo:constructor()
		self._bar = 5
	end
	function foo:_buzz()
	end
	function foo:_fuzz()
		self._bar = 6
		self:_buzz()
	end
end
```

## Configuration:
* `customPrefix` - a custom prefix instead of an underscore.
* `includeInternal` - transforms functions and fields marked as @internal.