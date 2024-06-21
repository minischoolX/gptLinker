"use strict";
(() => {
  // node_modules/frida-il2cpp-bridge/dist/index.js
  var __decorate = function(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
      r = Reflect.decorate(decorators, target, key, desc);
    else
      for (var i = decorators.length - 1; i >= 0; i--)
        if (d = decorators[i])
          r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
  };
  var Android;
  (function(Android2) {
    getter(Android2, "apiLevel", () => {
      const value = getProperty("ro.build.version.sdk");
      return value ? parseInt(value) : null;
    }, lazy);
    function getProperty(name) {
      const handle = Module.findExportByName("libc.so", "__system_property_get");
      if (handle) {
        const __system_property_get = new NativeFunction(handle, "void", ["pointer", "pointer"]);
        const value = Memory.alloc(92).writePointer(NULL);
        __system_property_get(Memory.allocUtf8String(name), value);
        return value.readCString() ?? void 0;
      }
    }
  })(Android || (Android = {}));
  function raise(message) {
    const error = new Error(`\x1B[0m${message}`);
    error.name = `\x1B[0m\x1B[38;5;9mil2cpp\x1B[0m`;
    error.stack = error.stack?.replace(/^Error/, error.name)?.replace(/\n    at (.+) \((.+):(.+)\)/, "\x1B[3m\x1B[2m")?.concat("\x1B[0m");
    throw error;
  }
  function warn(message) {
    globalThis.console.log(`\x1B[38;5;11mil2cpp\x1B[0m: ${message}`);
  }
  function ok(message) {
    globalThis.console.log(`\x1B[38;5;10mil2cpp\x1B[0m: ${message}`);
  }
  function inform(message) {
    globalThis.console.log(`\x1B[38;5;12mil2cpp\x1B[0m: ${message}`);
  }
  function decorate(target, decorator, descriptors = Object.getOwnPropertyDescriptors(target)) {
    for (const key in descriptors) {
      descriptors[key] = decorator(target, key, descriptors[key]);
    }
    Object.defineProperties(target, descriptors);
    return target;
  }
  function getter(target, key, get, decorator) {
    globalThis.Object.defineProperty(target, key, decorator?.(target, key, { get, configurable: true }) ?? { get, configurable: true });
  }
  function lazy(_, propertyKey, descriptor) {
    const getter2 = descriptor.get;
    if (!getter2) {
      throw new Error("@lazy can only be applied to getter accessors");
    }
    descriptor.get = function() {
      const value = getter2.call(this);
      Object.defineProperty(this, propertyKey, {
        value,
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,
        writable: false
      });
      return value;
    };
    return descriptor;
  }
  var NativeStruct = class {
    handle;
    constructor(handleOrWrapper) {
      if (handleOrWrapper instanceof NativePointer) {
        this.handle = handleOrWrapper;
      } else {
        this.handle = handleOrWrapper.handle;
      }
    }
    equals(other) {
      return this.handle.equals(other.handle);
    }
    isNull() {
      return this.handle.isNull();
    }
    asNullable() {
      return this.isNull() ? null : this;
    }
  };
  function forModule(...moduleNames) {
    function find(moduleName, name, readString = (_) => _.readUtf8String()) {
      const handle = Module.findExportByName(moduleName, name) ?? NULL;
      if (!handle.isNull()) {
        return { handle, readString };
      }
    }
    return new Promise((resolve) => {
      for (const moduleName of moduleNames) {
        const module = Process.findModuleByName(moduleName);
        if (module != null) {
          resolve(module);
          return;
        }
      }
      let targets = [];
      switch (Process.platform) {
        case "linux":
          if (Android.apiLevel == null) {
            targets = [find(null, "dlopen")];
            break;
          }
          targets = (Process.findModuleByName("linker64") ?? Process.getModuleByName("linker")).enumerateSymbols().filter((_) => ["__dl___loader_dlopen", "__dl__Z8__dlopenPKciPKv", "__dl_open"].includes(_.name)).map((_) => ({ handle: _.address, readString: (_2) => _2.readCString() }));
          break;
        case "darwin":
          targets = [find("libdyld.dylib", "dlopen")];
          break;
        case "windows":
          targets = [
            find("kernel32.dll", "LoadLibraryW", (_) => _.readUtf16String()),
            find("kernel32.dll", "LoadLibraryExW", (_) => _.readUtf16String()),
            find("kernel32.dll", "LoadLibraryA", (_) => _.readAnsiString()),
            find("kernel32.dll", "LoadLibraryExA", (_) => _.readAnsiString())
          ];
          break;
      }
      targets = targets.filter((_) => _);
      if (targets.length == 0) {
        raise(`there are no targets to hook the loading of \x1B[3m${moduleNames}\x1B[0m, please file a bug`);
      }
      const timeout = setTimeout(() => {
        for (const moduleName of moduleNames) {
          const module = Process.findModuleByName(moduleName);
          if (module != null) {
            warn(`\x1B[3m${module.name}\x1B[0m has been loaded, but such event hasn't been detected - please file a bug`);
            clearTimeout(timeout);
            interceptors.forEach((_) => _.detach());
            resolve(module);
            return;
          }
        }
        warn(`10 seconds have passed and \x1B[3m${moduleNames}\x1B[0m has not been loaded yet, is the app running?`);
      }, 1e4);
      const interceptors = targets.map((_) => Interceptor.attach(_.handle, {
        onEnter(args) {
          this.modulePath = _.readString(args[0]) ?? "";
        },
        onLeave(_2) {
          for (const moduleName of moduleNames) {
            if (this.modulePath.endsWith(moduleName)) {
              const module = Process.findModuleByName(this.modulePath);
              if (module != null) {
                setImmediate(() => {
                  clearTimeout(timeout);
                  interceptors.forEach((_3) => _3.detach());
                });
                resolve(module);
                break;
              }
            }
          }
        }
      }));
    });
  }
  NativePointer.prototype.offsetOf = function(condition, depth) {
    depth ??= 512;
    for (let i = 0; depth > 0 ? i < depth : i < -depth; i++) {
      if (condition(depth > 0 ? this.add(i) : this.sub(i))) {
        return i;
      }
    }
    return null;
  };
  function readNativeIterator(block) {
    const array = [];
    const iterator = Memory.alloc(Process.pointerSize);
    let handle = block(iterator);
    while (!handle.isNull()) {
      array.push(handle);
      handle = block(iterator);
    }
    return array;
  }
  function readNativeList(block) {
    const lengthPointer = Memory.alloc(Process.pointerSize);
    const startPointer = block(lengthPointer);
    if (startPointer.isNull()) {
      return [];
    }
    const array = new Array(lengthPointer.readInt());
    for (let i = 0; i < array.length; i++) {
      array[i] = startPointer.add(i * Process.pointerSize).readPointer();
    }
    return array;
  }
  function recycle(Class) {
    return new Proxy(Class, {
      cache: /* @__PURE__ */ new Map(),
      construct(Target, argArray) {
        const handle = argArray[0].toUInt32();
        if (!this.cache.has(handle)) {
          this.cache.set(handle, new Target(argArray[0]));
        }
        return this.cache.get(handle);
      }
    });
  }
  var UnityVersion;
  (function(UnityVersion2) {
    const pattern = /(20\d{2}|\d)\.(\d)\.(\d{1,2})(?:[abcfp]|rc){0,2}\d?/;
    function find(string) {
      return string?.match(pattern)?.[0];
    }
    UnityVersion2.find = find;
    function gte(a, b) {
      return compare(a, b) >= 0;
    }
    UnityVersion2.gte = gte;
    function lt(a, b) {
      return compare(a, b) < 0;
    }
    UnityVersion2.lt = lt;
    function compare(a, b) {
      const aMatches = a.match(pattern);
      const bMatches = b.match(pattern);
      for (let i = 1; i <= 3; i++) {
        const a2 = Number(aMatches?.[i] ?? -1);
        const b2 = Number(bMatches?.[i] ?? -1);
        if (a2 > b2)
          return 1;
        else if (a2 < b2)
          return -1;
      }
      return 0;
    }
  })(UnityVersion || (UnityVersion = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    Il2Cpp3.api = {
      get alloc() {
        return r("il2cpp_alloc", "pointer", ["size_t"]);
      },
      get arrayGetLength() {
        return r("il2cpp_array_length", "uint32", ["pointer"]);
      },
      get arrayNew() {
        return r("il2cpp_array_new", "pointer", ["pointer", "uint32"]);
      },
      get assemblyGetImage() {
        return r("il2cpp_assembly_get_image", "pointer", ["pointer"]);
      },
      get classForEach() {
        return r("il2cpp_class_for_each", "void", ["pointer", "pointer"]);
      },
      get classFromName() {
        return r("il2cpp_class_from_name", "pointer", ["pointer", "pointer", "pointer"]);
      },
      get classFromObject() {
        return r("il2cpp_class_from_system_type", "pointer", ["pointer"]);
      },
      get classGetArrayClass() {
        return r("il2cpp_array_class_get", "pointer", ["pointer", "uint32"]);
      },
      get classGetArrayElementSize() {
        return r("il2cpp_class_array_element_size", "int", ["pointer"]);
      },
      get classGetAssemblyName() {
        return r("il2cpp_class_get_assemblyname", "pointer", ["pointer"]);
      },
      get classGetBaseType() {
        return r("il2cpp_class_enum_basetype", "pointer", ["pointer"]);
      },
      get classGetDeclaringType() {
        return r("il2cpp_class_get_declaring_type", "pointer", ["pointer"]);
      },
      get classGetElementClass() {
        return r("il2cpp_class_get_element_class", "pointer", ["pointer"]);
      },
      get classGetFieldFromName() {
        return r("il2cpp_class_get_field_from_name", "pointer", ["pointer", "pointer"]);
      },
      get classGetFields() {
        return r("il2cpp_class_get_fields", "pointer", ["pointer", "pointer"]);
      },
      get classGetFlags() {
        return r("il2cpp_class_get_flags", "int", ["pointer"]);
      },
      get classGetImage() {
        return r("il2cpp_class_get_image", "pointer", ["pointer"]);
      },
      get classGetInstanceSize() {
        return r("il2cpp_class_instance_size", "int32", ["pointer"]);
      },
      get classGetInterfaces() {
        return r("il2cpp_class_get_interfaces", "pointer", ["pointer", "pointer"]);
      },
      get classGetMethodFromName() {
        return r("il2cpp_class_get_method_from_name", "pointer", ["pointer", "pointer", "int"]);
      },
      get classGetMethods() {
        return r("il2cpp_class_get_methods", "pointer", ["pointer", "pointer"]);
      },
      get classGetName() {
        return r("il2cpp_class_get_name", "pointer", ["pointer"]);
      },
      get classGetNamespace() {
        return r("il2cpp_class_get_namespace", "pointer", ["pointer"]);
      },
      get classGetNestedClasses() {
        return r("il2cpp_class_get_nested_types", "pointer", ["pointer", "pointer"]);
      },
      get classGetParent() {
        return r("il2cpp_class_get_parent", "pointer", ["pointer"]);
      },
      get classGetStaticFieldData() {
        return r("il2cpp_class_get_static_field_data", "pointer", ["pointer"]);
      },
      get classGetValueTypeSize() {
        return r("il2cpp_class_value_size", "int32", ["pointer", "pointer"]);
      },
      get classGetType() {
        return r("il2cpp_class_get_type", "pointer", ["pointer"]);
      },
      get classHasReferences() {
        return r("il2cpp_class_has_references", "bool", ["pointer"]);
      },
      get classInitialize() {
        return r("il2cpp_runtime_class_init", "void", ["pointer"]);
      },
      get classIsAbstract() {
        return r("il2cpp_class_is_abstract", "bool", ["pointer"]);
      },
      get classIsAssignableFrom() {
        return r("il2cpp_class_is_assignable_from", "bool", ["pointer", "pointer"]);
      },
      get classIsBlittable() {
        return r("il2cpp_class_is_blittable", "bool", ["pointer"]);
      },
      get classIsEnum() {
        return r("il2cpp_class_is_enum", "bool", ["pointer"]);
      },
      get classIsGeneric() {
        return r("il2cpp_class_is_generic", "bool", ["pointer"]);
      },
      get classIsInflated() {
        return r("il2cpp_class_is_inflated", "bool", ["pointer"]);
      },
      get classIsInterface() {
        return r("il2cpp_class_is_interface", "bool", ["pointer"]);
      },
      get classIsSubclassOf() {
        return r("il2cpp_class_is_subclass_of", "bool", ["pointer", "pointer", "bool"]);
      },
      get classIsValueType() {
        return r("il2cpp_class_is_valuetype", "bool", ["pointer"]);
      },
      get domainGetAssemblyFromName() {
        return r("il2cpp_domain_assembly_open", "pointer", ["pointer", "pointer"]);
      },
      get domainGet() {
        return r("il2cpp_domain_get", "pointer", []);
      },
      get domainGetAssemblies() {
        return r("il2cpp_domain_get_assemblies", "pointer", ["pointer", "pointer"]);
      },
      get fieldGetClass() {
        return r("il2cpp_field_get_parent", "pointer", ["pointer"]);
      },
      get fieldGetFlags() {
        return r("il2cpp_field_get_flags", "int", ["pointer"]);
      },
      get fieldGetName() {
        return r("il2cpp_field_get_name", "pointer", ["pointer"]);
      },
      get fieldGetOffset() {
        return r("il2cpp_field_get_offset", "int32", ["pointer"]);
      },
      get fieldGetStaticValue() {
        return r("il2cpp_field_static_get_value", "void", ["pointer", "pointer"]);
      },
      get fieldGetType() {
        return r("il2cpp_field_get_type", "pointer", ["pointer"]);
      },
      get fieldSetStaticValue() {
        return r("il2cpp_field_static_set_value", "void", ["pointer", "pointer"]);
      },
      get free() {
        return r("il2cpp_free", "void", ["pointer"]);
      },
      get gcCollect() {
        return r("il2cpp_gc_collect", "void", ["int"]);
      },
      get gcCollectALittle() {
        return r("il2cpp_gc_collect_a_little", "void", []);
      },
      get gcDisable() {
        return r("il2cpp_gc_disable", "void", []);
      },
      get gcEnable() {
        return r("il2cpp_gc_enable", "void", []);
      },
      get gcGetHeapSize() {
        return r("il2cpp_gc_get_heap_size", "int64", []);
      },
      get gcGetMaxTimeSlice() {
        return r("il2cpp_gc_get_max_time_slice_ns", "int64", []);
      },
      get gcGetUsedSize() {
        return r("il2cpp_gc_get_used_size", "int64", []);
      },
      get gcHandleGetTarget() {
        return r("il2cpp_gchandle_get_target", "pointer", ["uint32"]);
      },
      get gcHandleFree() {
        return r("il2cpp_gchandle_free", "void", ["uint32"]);
      },
      get gcHandleNew() {
        return r("il2cpp_gchandle_new", "uint32", ["pointer", "bool"]);
      },
      get gcHandleNewWeakRef() {
        return r("il2cpp_gchandle_new_weakref", "uint32", ["pointer", "bool"]);
      },
      get gcIsDisabled() {
        return r("il2cpp_gc_is_disabled", "bool", []);
      },
      get gcIsIncremental() {
        return r("il2cpp_gc_is_incremental", "bool", []);
      },
      get gcSetMaxTimeSlice() {
        return r("il2cpp_gc_set_max_time_slice_ns", "void", ["int64"]);
      },
      get gcStartIncrementalCollection() {
        return r("il2cpp_gc_start_incremental_collection", "void", []);
      },
      get gcStartWorld() {
        return r("il2cpp_start_gc_world", "void", []);
      },
      get gcStopWorld() {
        return r("il2cpp_stop_gc_world", "void", []);
      },
      get getCorlib() {
        return r("il2cpp_get_corlib", "pointer", []);
      },
      get imageGetAssembly() {
        return r("il2cpp_image_get_assembly", "pointer", ["pointer"]);
      },
      get imageGetClass() {
        return r("il2cpp_image_get_class", "pointer", ["pointer", "uint"]);
      },
      get imageGetClassCount() {
        return r("il2cpp_image_get_class_count", "uint32", ["pointer"]);
      },
      get imageGetName() {
        return r("il2cpp_image_get_name", "pointer", ["pointer"]);
      },
      get initialize() {
        return r("il2cpp_init", "void", ["pointer"]);
      },
      get livenessAllocateStruct() {
        return r("il2cpp_unity_liveness_allocate_struct", "pointer", ["pointer", "int", "pointer", "pointer", "pointer"]);
      },
      get livenessCalculationBegin() {
        return r("il2cpp_unity_liveness_calculation_begin", "pointer", ["pointer", "int", "pointer", "pointer", "pointer", "pointer"]);
      },
      get livenessCalculationEnd() {
        return r("il2cpp_unity_liveness_calculation_end", "void", ["pointer"]);
      },
      get livenessCalculationFromStatics() {
        return r("il2cpp_unity_liveness_calculation_from_statics", "void", ["pointer"]);
      },
      get livenessFinalize() {
        return r("il2cpp_unity_liveness_finalize", "void", ["pointer"]);
      },
      get livenessFreeStruct() {
        return r("il2cpp_unity_liveness_free_struct", "void", ["pointer"]);
      },
      get memorySnapshotCapture() {
        return r("il2cpp_capture_memory_snapshot", "pointer", []);
      },
      get memorySnapshotFree() {
        return r("il2cpp_free_captured_memory_snapshot", "void", ["pointer"]);
      },
      get memorySnapshotGetClasses() {
        return r("il2cpp_memory_snapshot_get_classes", "pointer", ["pointer", "pointer"]);
      },
      get memorySnapshotGetObjects() {
        return r("il2cpp_memory_snapshot_get_objects", "pointer", ["pointer", "pointer"]);
      },
      get methodGetClass() {
        return r("il2cpp_method_get_class", "pointer", ["pointer"]);
      },
      get methodGetFlags() {
        return r("il2cpp_method_get_flags", "uint32", ["pointer", "pointer"]);
      },
      get methodGetName() {
        return r("il2cpp_method_get_name", "pointer", ["pointer"]);
      },
      get methodGetObject() {
        return r("il2cpp_method_get_object", "pointer", ["pointer", "pointer"]);
      },
      get methodGetParameterCount() {
        return r("il2cpp_method_get_param_count", "uint8", ["pointer"]);
      },
      get methodGetParameterName() {
        return r("il2cpp_method_get_param_name", "pointer", ["pointer", "uint32"]);
      },
      get methodGetParameters() {
        return r("il2cpp_method_get_parameters", "pointer", ["pointer", "pointer"]);
      },
      get methodGetParameterType() {
        return r("il2cpp_method_get_param", "pointer", ["pointer", "uint32"]);
      },
      get methodGetReturnType() {
        return r("il2cpp_method_get_return_type", "pointer", ["pointer"]);
      },
      get methodIsGeneric() {
        return r("il2cpp_method_is_generic", "bool", ["pointer"]);
      },
      get methodIsInflated() {
        return r("il2cpp_method_is_inflated", "bool", ["pointer"]);
      },
      get methodIsInstance() {
        return r("il2cpp_method_is_instance", "bool", ["pointer"]);
      },
      get monitorEnter() {
        return r("il2cpp_monitor_enter", "void", ["pointer"]);
      },
      get monitorExit() {
        return r("il2cpp_monitor_exit", "void", ["pointer"]);
      },
      get monitorPulse() {
        return r("il2cpp_monitor_pulse", "void", ["pointer"]);
      },
      get monitorPulseAll() {
        return r("il2cpp_monitor_pulse_all", "void", ["pointer"]);
      },
      get monitorTryEnter() {
        return r("il2cpp_monitor_try_enter", "bool", ["pointer", "uint32"]);
      },
      get monitorTryWait() {
        return r("il2cpp_monitor_try_wait", "bool", ["pointer", "uint32"]);
      },
      get monitorWait() {
        return r("il2cpp_monitor_wait", "void", ["pointer"]);
      },
      get objectGetClass() {
        return r("il2cpp_object_get_class", "pointer", ["pointer"]);
      },
      get objectGetVirtualMethod() {
        return r("il2cpp_object_get_virtual_method", "pointer", ["pointer", "pointer"]);
      },
      get objectInitialize() {
        return r("il2cpp_runtime_object_init_exception", "void", ["pointer", "pointer"]);
      },
      get objectNew() {
        return r("il2cpp_object_new", "pointer", ["pointer"]);
      },
      get objectGetSize() {
        return r("il2cpp_object_get_size", "uint32", ["pointer"]);
      },
      get objectUnbox() {
        return r("il2cpp_object_unbox", "pointer", ["pointer"]);
      },
      get resolveInternalCall() {
        return r("il2cpp_resolve_icall", "pointer", ["pointer"]);
      },
      get stringGetChars() {
        return r("il2cpp_string_chars", "pointer", ["pointer"]);
      },
      get stringGetLength() {
        return r("il2cpp_string_length", "int32", ["pointer"]);
      },
      get stringNew() {
        return r("il2cpp_string_new", "pointer", ["pointer"]);
      },
      get valueTypeBox() {
        return r("il2cpp_value_box", "pointer", ["pointer", "pointer"]);
      },
      get threadAttach() {
        return r("il2cpp_thread_attach", "pointer", ["pointer"]);
      },
      get threadDetach() {
        return r("il2cpp_thread_detach", "void", ["pointer"]);
      },
      get threadGetAttachedThreads() {
        return r("il2cpp_thread_get_all_attached_threads", "pointer", ["pointer"]);
      },
      get threadGetCurrent() {
        return r("il2cpp_thread_current", "pointer", []);
      },
      get threadIsVm() {
        return r("il2cpp_is_vm_thread", "bool", ["pointer"]);
      },
      get typeGetClass() {
        return r("il2cpp_class_from_type", "pointer", ["pointer"]);
      },
      get typeGetName() {
        return r("il2cpp_type_get_name", "pointer", ["pointer"]);
      },
      get typeGetObject() {
        return r("il2cpp_type_get_object", "pointer", ["pointer"]);
      },
      get typeGetTypeEnum() {
        return r("il2cpp_type_get_type", "int", ["pointer"]);
      }
    };
    decorate(Il2Cpp3.api, lazy);
    getter(Il2Cpp3, "memorySnapshotApi", () => new CModule("#include <stdint.h>\n#include <string.h>\n\ntypedef struct Il2CppManagedMemorySnapshot Il2CppManagedMemorySnapshot;\ntypedef struct Il2CppMetadataType Il2CppMetadataType;\n\nstruct Il2CppManagedMemorySnapshot\n{\n  struct Il2CppManagedHeap\n  {\n    uint32_t section_count;\n    void * sections;\n  } heap;\n  struct Il2CppStacks\n  {\n    uint32_t stack_count;\n    void * stacks;\n  } stacks;\n  struct Il2CppMetadataSnapshot\n  {\n    uint32_t type_count;\n    Il2CppMetadataType * types;\n  } metadata_snapshot;\n  struct Il2CppGCHandles\n  {\n    uint32_t tracked_object_count;\n    void ** pointers_to_objects;\n  } gc_handles;\n  struct Il2CppRuntimeInformation\n  {\n    uint32_t pointer_size;\n    uint32_t object_header_size;\n    uint32_t array_header_size;\n    uint32_t array_bounds_offset_in_header;\n    uint32_t array_size_offset_in_header;\n    uint32_t allocation_granularity;\n  } runtime_information;\n  void * additional_user_information;\n};\n\nstruct Il2CppMetadataType\n{\n  uint32_t flags;\n  void * fields;\n  uint32_t field_count;\n  uint32_t statics_size;\n  uint8_t * statics;\n  uint32_t base_or_element_type_index;\n  char * name;\n  const char * assembly_name;\n  uint64_t type_info_address;\n  uint32_t size;\n};\n\nuintptr_t\nil2cpp_memory_snapshot_get_classes (\n    const Il2CppManagedMemorySnapshot * snapshot, Il2CppMetadataType ** iter)\n{\n  const int zero = 0;\n  const void * null = 0;\n\n  if (iter != NULL && snapshot->metadata_snapshot.type_count > zero)\n  {\n    if (*iter == null)\n    {\n      *iter = snapshot->metadata_snapshot.types;\n      return (uintptr_t) (*iter)->type_info_address;\n    }\n    else\n    {\n      Il2CppMetadataType * metadata_type = *iter + 1;\n\n      if (metadata_type < snapshot->metadata_snapshot.types +\n                              snapshot->metadata_snapshot.type_count)\n      {\n        *iter = metadata_type;\n        return (uintptr_t) (*iter)->type_info_address;\n      }\n    }\n  }\n  return 0;\n}\n\nvoid **\nil2cpp_memory_snapshot_get_objects (\n    const Il2CppManagedMemorySnapshot * snapshot, uint32_t * size)\n{\n  *size = snapshot->gc_handles.tracked_object_count;\n  return snapshot->gc_handles.pointers_to_objects;\n}\n"), lazy);
    function r(exportName, retType, argTypes) {
      const handle = globalThis.IL2CPP_EXPORTS?.[exportName]?.() ?? Il2Cpp3.module.findExportByName(exportName) ?? Il2Cpp3.memorySnapshotApi[exportName];
      return new NativeFunction(handle ?? raise(`couldn't resolve export ${exportName}`), retType, argTypes);
    }
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    Il2Cpp3.application = {
      /** */
      get dataPath() {
        return unityEngineCall("get_persistentDataPath");
      },
      /** */
      get identifier() {
        return unityEngineCall("get_identifier") ?? unityEngineCall("get_bundleIdentifier");
      },
      /** Gets the version of the application */
      get version() {
        return unityEngineCall("get_version");
      }
    };
    getter(Il2Cpp3, "unityVersion", () => {
      try {
        const unityVersion = globalThis.IL2CPP_UNITY_VERSION ?? unityEngineCall("get_unityVersion");
        if (unityVersion != null) {
          return unityVersion;
        }
      } catch (_) {
      }
      const searchPattern = "69 6c 32 63 70 70";
      for (const range of Il2Cpp3.module.enumerateRanges("r--").concat(Process.getRangeByAddress(Il2Cpp3.module.base))) {
        for (let { address } of Memory.scanSync(range.base, range.size, searchPattern)) {
          while (address.readU8() != 0) {
            address = address.sub(1);
          }
          const match = UnityVersion.find(address.add(1).readCString());
          if (match != void 0) {
            return match;
          }
        }
      }
      raise("couldn't determine the Unity version, please specify it manually");
    }, lazy);
    getter(Il2Cpp3, "unityVersionIsBelow201830", () => {
      return UnityVersion.lt(Il2Cpp3.unityVersion, "2018.3.0");
    }, lazy);
    getter(Il2Cpp3, "unityVersionIsBelow202120", () => {
      return UnityVersion.lt(Il2Cpp3.unityVersion, "2021.2.0");
    }, lazy);
    function unityEngineCall(method) {
      const handle = Il2Cpp3.api.resolveInternalCall(Memory.allocUtf8String("UnityEngine.Application::" + method));
      const nativeFunction = new NativeFunction(handle, "pointer", []);
      return nativeFunction.isNull() ? null : new Il2Cpp3.String(nativeFunction()).asNullable()?.content ?? null;
    }
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    function dump(fileName, path) {
      fileName = fileName ?? `${Il2Cpp3.application.identifier ?? "unknown"}_${Il2Cpp3.application.version ?? "unknown"}.cs`;
      const destination = `${path ?? Il2Cpp3.application.dataPath}/${fileName}`;
      const file = new File(destination, "w");
      for (const assembly of Il2Cpp3.domain.assemblies) {
        inform(`dumping ${assembly.name}...`);
        for (const klass of assembly.image.classes) {
          file.write(`${klass}

`);
        }
      }
      file.flush();
      file.close();
      ok(`dump saved to ${destination}`);
    }
    Il2Cpp3.dump = dump;
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    function installExceptionListener(targetThread = "current") {
      const currentThread = Il2Cpp3.api.threadGetCurrent();
      return Interceptor.attach(Il2Cpp3.module.getExportByName("__cxa_throw"), function(args) {
        if (targetThread == "current" && !Il2Cpp3.api.threadGetCurrent().equals(currentThread)) {
          return;
        }
        inform(new Il2Cpp3.Object(args[0].readPointer()));
      });
    }
    Il2Cpp3.installExceptionListener = installExceptionListener;
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    function is(klass) {
      return (element) => {
        if (element instanceof Il2Cpp3.Class) {
          return klass.isAssignableFrom(element);
        } else {
          return klass.isAssignableFrom(element.class);
        }
      };
    }
    Il2Cpp3.is = is;
    function isExactly(klass) {
      return (element) => {
        if (element instanceof Il2Cpp3.Class) {
          return element.equals(klass);
        } else {
          return element.class.equals(klass);
        }
      };
    }
    Il2Cpp3.isExactly = isExactly;
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    Il2Cpp3.gc = {
      /** Gets the heap size in bytes. */
      get heapSize() {
        return Il2Cpp3.api.gcGetHeapSize();
      },
      /** Determines whether the garbage collector is disabled. */
      get isEnabled() {
        return !Il2Cpp3.api.gcIsDisabled();
      },
      /** Determines whether the garbage collector is incremental. */
      get isIncremental() {
        return !!Il2Cpp3.api.gcIsIncremental();
      },
      /** Gets the number of nanoseconds the garbage collector can spend in a collection step. */
      get maxTimeSlice() {
        return Il2Cpp3.api.gcGetMaxTimeSlice();
      },
      /** Gets the used heap size in bytes. */
      get usedHeapSize() {
        return Il2Cpp3.api.gcGetUsedSize();
      },
      /** Enables or disables the garbage collector. */
      set isEnabled(value) {
        value ? Il2Cpp3.api.gcEnable() : Il2Cpp3.api.gcDisable();
      },
      /** Sets the number of nanoseconds the garbage collector can spend in a collection step. */
      set maxTimeSlice(nanoseconds) {
        Il2Cpp3.api.gcSetMaxTimeSlice(nanoseconds);
      },
      /** Returns the heap allocated objects of the specified class. This variant reads GC descriptors. */
      choose(klass) {
        const matches = [];
        const callback = (objects, size) => {
          for (let i = 0; i < size; i++) {
            matches.push(new Il2Cpp3.Object(objects.add(i * Process.pointerSize).readPointer()));
          }
        };
        const chooseCallback = new NativeCallback(callback, "void", ["pointer", "int", "pointer"]);
        if (Il2Cpp3.unityVersionIsBelow202120) {
          const onWorld = new NativeCallback(() => {
          }, "void", []);
          const state = Il2Cpp3.api.livenessCalculationBegin(klass, 0, chooseCallback, NULL, onWorld, onWorld);
          Il2Cpp3.api.livenessCalculationFromStatics(state);
          Il2Cpp3.api.livenessCalculationEnd(state);
        } else {
          const realloc = (handle, size) => {
            if (!handle.isNull() && size.compare(0) == 0) {
              Il2Cpp3.free(handle);
              return NULL;
            } else {
              return Il2Cpp3.alloc(size);
            }
          };
          const reallocCallback = new NativeCallback(realloc, "pointer", ["pointer", "size_t", "pointer"]);
          this.stopWorld();
          const state = Il2Cpp3.api.livenessAllocateStruct(klass, 0, chooseCallback, NULL, reallocCallback);
          Il2Cpp3.api.livenessCalculationFromStatics(state);
          Il2Cpp3.api.livenessFinalize(state);
          this.startWorld();
          Il2Cpp3.api.livenessFreeStruct(state);
        }
        return matches;
      },
      /** Forces a garbage collection of the specified generation. */
      collect(generation) {
        Il2Cpp3.api.gcCollect(generation < 0 ? 0 : generation > 2 ? 2 : generation);
      },
      /** Forces a garbage collection. */
      collectALittle() {
        Il2Cpp3.api.gcCollectALittle();
      },
      /** Resumes all the previously stopped threads. */
      startWorld() {
        return Il2Cpp3.api.gcStartWorld();
      },
      /** Performs an incremental garbage collection. */
      startIncrementalCollection() {
        return Il2Cpp3.api.gcStartIncrementalCollection();
      },
      /** Stops all threads which may access the garbage collected heap, other than the caller. */
      stopWorld() {
        return Il2Cpp3.api.gcStopWorld();
      }
    };
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    function alloc(size = Process.pointerSize) {
      return Il2Cpp3.api.alloc(size);
    }
    Il2Cpp3.alloc = alloc;
    function free(pointer) {
      return Il2Cpp3.api.free(pointer);
    }
    Il2Cpp3.free = free;
    function read(pointer, type) {
      switch (type.typeEnum) {
        case Il2Cpp3.Type.enum.boolean:
          return !!pointer.readS8();
        case Il2Cpp3.Type.enum.byte:
          return pointer.readS8();
        case Il2Cpp3.Type.enum.unsignedByte:
          return pointer.readU8();
        case Il2Cpp3.Type.enum.short:
          return pointer.readS16();
        case Il2Cpp3.Type.enum.unsignedShort:
          return pointer.readU16();
        case Il2Cpp3.Type.enum.int:
          return pointer.readS32();
        case Il2Cpp3.Type.enum.unsignedInt:
          return pointer.readU32();
        case Il2Cpp3.Type.enum.char:
          return pointer.readU16();
        case Il2Cpp3.Type.enum.long:
          return pointer.readS64();
        case Il2Cpp3.Type.enum.unsignedLong:
          return pointer.readU64();
        case Il2Cpp3.Type.enum.float:
          return pointer.readFloat();
        case Il2Cpp3.Type.enum.double:
          return pointer.readDouble();
        case Il2Cpp3.Type.enum.nativePointer:
        case Il2Cpp3.Type.enum.unsignedNativePointer:
          return pointer.readPointer();
        case Il2Cpp3.Type.enum.pointer:
          return new Il2Cpp3.Pointer(pointer.readPointer(), type.class.baseType);
        case Il2Cpp3.Type.enum.valueType:
          return new Il2Cpp3.ValueType(pointer, type);
        case Il2Cpp3.Type.enum.object:
        case Il2Cpp3.Type.enum.class:
          return new Il2Cpp3.Object(pointer.readPointer());
        case Il2Cpp3.Type.enum.genericInstance:
          return type.class.isValueType ? new Il2Cpp3.ValueType(pointer, type) : new Il2Cpp3.Object(pointer.readPointer());
        case Il2Cpp3.Type.enum.string:
          return new Il2Cpp3.String(pointer.readPointer());
        case Il2Cpp3.Type.enum.array:
        case Il2Cpp3.Type.enum.multidimensionalArray:
          return new Il2Cpp3.Array(pointer.readPointer());
      }
      raise(`couldn't read the value from ${pointer} using an unhandled or unknown type ${type.name} (${type.typeEnum}), please file an issue`);
    }
    Il2Cpp3.read = read;
    function write(pointer, value, type) {
      switch (type.typeEnum) {
        case Il2Cpp3.Type.enum.boolean:
          return pointer.writeS8(+value);
        case Il2Cpp3.Type.enum.byte:
          return pointer.writeS8(value);
        case Il2Cpp3.Type.enum.unsignedByte:
          return pointer.writeU8(value);
        case Il2Cpp3.Type.enum.short:
          return pointer.writeS16(value);
        case Il2Cpp3.Type.enum.unsignedShort:
          return pointer.writeU16(value);
        case Il2Cpp3.Type.enum.int:
          return pointer.writeS32(value);
        case Il2Cpp3.Type.enum.unsignedInt:
          return pointer.writeU32(value);
        case Il2Cpp3.Type.enum.char:
          return pointer.writeU16(value);
        case Il2Cpp3.Type.enum.long:
          return pointer.writeS64(value);
        case Il2Cpp3.Type.enum.unsignedLong:
          return pointer.writeU64(value);
        case Il2Cpp3.Type.enum.float:
          return pointer.writeFloat(value);
        case Il2Cpp3.Type.enum.double:
          return pointer.writeDouble(value);
        case Il2Cpp3.Type.enum.nativePointer:
        case Il2Cpp3.Type.enum.unsignedNativePointer:
        case Il2Cpp3.Type.enum.pointer:
        case Il2Cpp3.Type.enum.string:
        case Il2Cpp3.Type.enum.array:
        case Il2Cpp3.Type.enum.multidimensionalArray:
          return pointer.writePointer(value);
        case Il2Cpp3.Type.enum.valueType:
          return Memory.copy(pointer, value, type.class.valueTypeSize), pointer;
        case Il2Cpp3.Type.enum.object:
        case Il2Cpp3.Type.enum.class:
        case Il2Cpp3.Type.enum.genericInstance:
          return value instanceof Il2Cpp3.ValueType ? (Memory.copy(pointer, value, type.class.valueTypeSize), pointer) : pointer.writePointer(value);
      }
      raise(`couldn't write value ${value} to ${pointer} using an unhandled or unknown type ${type.name} (${type.typeEnum}), please file an issue`);
    }
    Il2Cpp3.write = write;
    function fromFridaValue(value, type) {
      if (globalThis.Array.isArray(value)) {
        const handle = Memory.alloc(type.class.valueTypeSize);
        const fields = type.class.fields.filter((_) => !_.isStatic);
        for (let i = 0; i < fields.length; i++) {
          const convertedValue = fromFridaValue(value[i], fields[i].type);
          write(handle.add(fields[i].offset).sub(Il2Cpp3.Object.headerSize), convertedValue, fields[i].type);
        }
        return new Il2Cpp3.ValueType(handle, type);
      } else if (value instanceof NativePointer) {
        if (type.isByReference) {
          return new Il2Cpp3.Reference(value, type);
        }
        switch (type.typeEnum) {
          case Il2Cpp3.Type.enum.pointer:
            return new Il2Cpp3.Pointer(value, type.class.baseType);
          case Il2Cpp3.Type.enum.string:
            return new Il2Cpp3.String(value);
          case Il2Cpp3.Type.enum.class:
          case Il2Cpp3.Type.enum.genericInstance:
          case Il2Cpp3.Type.enum.object:
            return new Il2Cpp3.Object(value);
          case Il2Cpp3.Type.enum.array:
          case Il2Cpp3.Type.enum.multidimensionalArray:
            return new Il2Cpp3.Array(value);
          default:
            return value;
        }
      } else if (type.typeEnum == Il2Cpp3.Type.enum.boolean) {
        return !!value;
      } else if (type.typeEnum == Il2Cpp3.Type.enum.valueType && type.class.isEnum) {
        return fromFridaValue([value], type);
      } else {
        return value;
      }
    }
    Il2Cpp3.fromFridaValue = fromFridaValue;
    function toFridaValue(value) {
      if (typeof value == "boolean") {
        return +value;
      } else if (value instanceof Il2Cpp3.ValueType) {
        if (value.type.class.isEnum) {
          return value.field("value__").value;
        } else {
          const _ = value.type.class.fields.filter((_2) => !_2.isStatic).map((_2) => toFridaValue(_2.withHolder(value).value));
          return _.length == 0 ? [0] : _;
        }
      } else {
        return value;
      }
    }
    Il2Cpp3.toFridaValue = toFridaValue;
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    getter(Il2Cpp3, "module", () => {
      const [moduleName, fallback] = getExpectedModuleNames();
      return Process.findModuleByName(moduleName) ?? Process.getModuleByName(fallback);
    });
    async function initialize(blocking = false) {
      Reflect.defineProperty(Il2Cpp3, "module", {
        // prettier-ignore
        value: Process.platform == "darwin" ? Process.findModuleByAddress(DebugSymbol.fromName("il2cpp_init").address) ?? await forModule(...getExpectedModuleNames()) : await forModule(...getExpectedModuleNames())
      });
      if (Il2Cpp3.api.getCorlib().isNull()) {
        return await new Promise((resolve) => {
          const interceptor = Interceptor.attach(Il2Cpp3.api.initialize, {
            onLeave() {
              interceptor.detach();
              blocking ? resolve(true) : setImmediate(() => resolve(false));
            }
          });
        });
      }
      return false;
    }
    Il2Cpp3.initialize = initialize;
    function getExpectedModuleNames() {
      if (globalThis.IL2CPP_MODULE_NAME) {
        return [globalThis.IL2CPP_MODULE_NAME];
      }
      switch (Process.platform) {
        case "linux":
          return [Android.apiLevel ? "libil2cpp.so" : "GameAssembly.so"];
        case "windows":
          return ["GameAssembly.dll"];
        case "darwin":
          return ["UnityFramework", "GameAssembly.dylib"];
      }
      raise(`${Process.platform} is not supported yet`);
    }
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    async function perform(block, flag = "bind") {
      try {
        const isInMainThread = await Il2Cpp3.initialize(flag == "main");
        if (flag == "main" && !isInMainThread) {
          return perform(() => Il2Cpp3.mainThread.schedule(block), "free");
        }
        let thread = Il2Cpp3.currentThread;
        const isForeignThread = thread == null;
        thread ??= Il2Cpp3.domain.attach();
        const result = block();
        if (isForeignThread) {
          if (flag == "free") {
            thread.detach();
          } else if (flag == "bind") {
            Script.bindWeak(globalThis, () => thread.detach());
          }
        }
        return result instanceof Promise ? await result : result;
      } catch (error) {
        Script.nextTick((_) => {
          throw _;
        }, error);
        return Promise.reject(error);
      }
    }
    Il2Cpp3.perform = perform;
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    class Tracer {
      /** @internal */
      #state = {
        depth: 0,
        buffer: [],
        history: /* @__PURE__ */ new Set(),
        flush: () => {
          if (this.#state.depth == 0) {
            const message = `
${this.#state.buffer.join("\n")}
`;
            if (this.#verbose) {
              inform(message);
            } else {
              const hash = cyrb53(message);
              if (!this.#state.history.has(hash)) {
                this.#state.history.add(hash);
                inform(message);
              }
            }
            this.#state.buffer.length = 0;
          }
        }
      };
      /** @internal */
      #threadId = Il2Cpp3.mainThread.id;
      /** @internal */
      #verbose = false;
      /** @internal */
      #applier;
      /** @internal */
      #targets = [];
      /** @internal */
      #domain;
      /** @internal */
      #assemblies;
      /** @internal */
      #classes;
      /** @internal */
      #methods;
      /** @internal */
      #assemblyFilter;
      /** @internal */
      #classFilter;
      /** @internal */
      #methodFilter;
      /** @internal */
      #parameterFilter;
      constructor(applier) {
        this.#applier = applier;
      }
      /** */
      thread(thread) {
        this.#threadId = thread.id;
        return this;
      }
      /** Determines whether print duplicate logs. */
      verbose(value) {
        this.#verbose = value;
        return this;
      }
      /** Sets the application domain as the place where to find the target methods. */
      domain() {
        this.#domain = Il2Cpp3.domain;
        return this;
      }
      /** Sets the passed `assemblies` as the place where to find the target methods. */
      assemblies(...assemblies) {
        this.#assemblies = assemblies;
        return this;
      }
      /** Sets the passed `classes` as the place where to find the target methods. */
      classes(...classes) {
        this.#classes = classes;
        return this;
      }
      /** Sets the passed `methods` as the target methods. */
      methods(...methods) {
        this.#methods = methods;
        return this;
      }
      /** Filters the assemblies where to find the target methods. */
      filterAssemblies(filter) {
        this.#assemblyFilter = filter;
        return this;
      }
      /** Filters the classes where to find the target methods. */
      filterClasses(filter) {
        this.#classFilter = filter;
        return this;
      }
      /** Filters the target methods. */
      filterMethods(filter) {
        this.#methodFilter = filter;
        return this;
      }
      /** Filters the target methods. */
      filterParameters(filter) {
        this.#parameterFilter = filter;
        return this;
      }
      /** Commits the current changes by finding the target methods. */
      and() {
        const filterMethod = (method) => {
          if (this.#parameterFilter == void 0) {
            this.#targets.push(method);
            return;
          }
          for (const parameter of method.parameters) {
            if (this.#parameterFilter(parameter)) {
              this.#targets.push(method);
              break;
            }
          }
        };
        const filterMethods = (values) => {
          for (const method of values) {
            filterMethod(method);
          }
        };
        const filterClass = (klass) => {
          if (this.#methodFilter == void 0) {
            filterMethods(klass.methods);
            return;
          }
          for (const method of klass.methods) {
            if (this.#methodFilter(method)) {
              filterMethod(method);
            }
          }
        };
        const filterClasses = (values) => {
          for (const klass of values) {
            filterClass(klass);
          }
        };
        const filterAssembly = (assembly) => {
          if (this.#classFilter == void 0) {
            filterClasses(assembly.image.classes);
            return;
          }
          for (const klass of assembly.image.classes) {
            if (this.#classFilter(klass)) {
              filterClass(klass);
            }
          }
        };
        const filterAssemblies = (assemblies) => {
          for (const assembly of assemblies) {
            filterAssembly(assembly);
          }
        };
        const filterDomain = (domain) => {
          if (this.#assemblyFilter == void 0) {
            filterAssemblies(domain.assemblies);
            return;
          }
          for (const assembly of domain.assemblies) {
            if (this.#assemblyFilter(assembly)) {
              filterAssembly(assembly);
            }
          }
        };
        this.#methods ? filterMethods(this.#methods) : this.#classes ? filterClasses(this.#classes) : this.#assemblies ? filterAssemblies(this.#assemblies) : this.#domain ? filterDomain(this.#domain) : void 0;
        this.#assemblies = void 0;
        this.#classes = void 0;
        this.#methods = void 0;
        this.#assemblyFilter = void 0;
        this.#classFilter = void 0;
        this.#methodFilter = void 0;
        this.#parameterFilter = void 0;
        return this;
      }
      /** Starts tracing. */
      attach() {
        for (const target of this.#targets) {
          if (!target.virtualAddress.isNull()) {
            try {
              this.#applier(target, this.#state, this.#threadId);
            } catch (e) {
              switch (e.message) {
                case /unable to intercept function at \w+; please file a bug/.exec(e.message)?.input:
                case "already replaced this function":
                  break;
                default:
                  throw e;
              }
            }
          }
        }
      }
    }
    Il2Cpp3.Tracer = Tracer;
    function trace(parameters = false) {
      const applier = () => (method, state, threadId) => {
        const paddedVirtualAddress = method.relativeVirtualAddress.toString(16).padStart(8, "0");
        Interceptor.attach(method.virtualAddress, {
          onEnter() {
            if (this.threadId == threadId) {
              state.buffer.push(`\x1B[2m0x${paddedVirtualAddress}\x1B[0m ${`\u2502 `.repeat(state.depth++)}\u250C\u2500\x1B[35m${method.class.type.name}::\x1B[1m${method.name}\x1B[0m\x1B[0m`);
            }
          },
          onLeave() {
            if (this.threadId == threadId) {
              state.buffer.push(`\x1B[2m0x${paddedVirtualAddress}\x1B[0m ${`\u2502 `.repeat(--state.depth)}\u2514\u2500\x1B[33m${method.class.type.name}::\x1B[1m${method.name}\x1B[0m\x1B[0m`);
              state.flush();
            }
          }
        });
      };
      const applierWithParameters = () => (method, state, threadId) => {
        const paddedVirtualAddress = method.relativeVirtualAddress.toString(16).padStart(8, "0");
        const startIndex = +!method.isStatic | +Il2Cpp3.unityVersionIsBelow201830;
        const callback = function(...args) {
          if (this.threadId == threadId) {
            const thisParameter = method.isStatic ? void 0 : new Il2Cpp3.Parameter("this", -1, method.class.type);
            const parameters2 = thisParameter ? [thisParameter].concat(method.parameters) : method.parameters;
            state.buffer.push(`\x1B[2m0x${paddedVirtualAddress}\x1B[0m ${`\u2502 `.repeat(state.depth++)}\u250C\u2500\x1B[35m${method.class.type.name}::\x1B[1m${method.name}\x1B[0m\x1B[0m(${parameters2.map((e) => `\x1B[32m${e.name}\x1B[0m = \x1B[31m${Il2Cpp3.fromFridaValue(args[e.position + startIndex], e.type)}\x1B[0m`).join(", ")})`);
          }
          const returnValue = method.nativeFunction(...args);
          if (this.threadId == threadId) {
            state.buffer.push(`\x1B[2m0x${paddedVirtualAddress}\x1B[0m ${`\u2502 `.repeat(--state.depth)}\u2514\u2500\x1B[33m${method.class.type.name}::\x1B[1m${method.name}\x1B[0m\x1B[0m${returnValue == void 0 ? "" : ` = \x1B[36m${Il2Cpp3.fromFridaValue(returnValue, method.returnType)}`}\x1B[0m`);
            state.flush();
          }
          return returnValue;
        };
        method.revert();
        const nativeCallback = new NativeCallback(callback, method.returnType.fridaAlias, method.fridaSignature);
        Interceptor.replace(method.virtualAddress, nativeCallback);
      };
      return new Il2Cpp3.Tracer(parameters ? applierWithParameters() : applier());
    }
    Il2Cpp3.trace = trace;
    function backtrace(mode) {
      const methods = Il2Cpp3.domain.assemblies.flatMap((_) => _.image.classes.flatMap((_2) => _2.methods.filter((_3) => !_3.virtualAddress.isNull()))).sort((_, __) => _.virtualAddress.compare(__.virtualAddress));
      const searchInsert = (target) => {
        let left = 0;
        let right = methods.length - 1;
        while (left <= right) {
          const pivot = Math.floor((left + right) / 2);
          const comparison = methods[pivot].virtualAddress.compare(target);
          if (comparison == 0) {
            return methods[pivot];
          } else if (comparison > 0) {
            right = pivot - 1;
          } else {
            left = pivot + 1;
          }
        }
        return methods[right];
      };
      const applier = () => (method, state, threadId) => {
        Interceptor.attach(method.virtualAddress, function() {
          if (this.threadId == threadId) {
            const handles = globalThis.Thread.backtrace(this.context, mode);
            handles.unshift(method.virtualAddress);
            for (const handle of handles) {
              if (handle.compare(Il2Cpp3.module.base) > 0 && handle.compare(Il2Cpp3.module.base.add(Il2Cpp3.module.size)) < 0) {
                const method2 = searchInsert(handle);
                if (method2) {
                  const offset = handle.sub(method2.virtualAddress);
                  if (offset.compare(4095) < 0) {
                    state.buffer.push(`\x1B[2m0x${method2.relativeVirtualAddress.toString(16).padStart(8, "0")}\x1B[0m\x1B[2m+0x${offset.toString(16).padStart(3, `0`)}\x1B[0m ${method2.class.type.name}::\x1B[1m${method2.name}\x1B[0m`);
                  }
                }
              }
            }
            state.flush();
          }
        });
      };
      return new Il2Cpp3.Tracer(applier());
    }
    Il2Cpp3.backtrace = backtrace;
    function cyrb53(str) {
      let h1 = 3735928559;
      let h2 = 1103547991;
      for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
      }
      h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507);
      h1 ^= Math.imul(h2 ^ h2 >>> 13, 3266489909);
      h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507);
      h2 ^= Math.imul(h1 ^ h1 >>> 13, 3266489909);
      return 4294967296 * (2097151 & h2) + (h1 >>> 0);
    }
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    class Array2 extends NativeStruct {
      /** Gets the Il2CppArray struct size, possibly equal to `Process.pointerSize * 4`. */
      static get headerSize() {
        return Il2Cpp3.corlib.class("System.Array").instanceSize;
      }
      /** @internal Gets a pointer to the first element of the current array. */
      get elements() {
        const array2 = Il2Cpp3.string("v").object.method("ToCharArray", 0).invoke();
        const offset = array2.handle.offsetOf((_) => _.readS16() == 118) ?? raise("couldn't find the elements offset in the native array struct");
        getter(Il2Cpp3.Array.prototype, "elements", function() {
          return new Il2Cpp3.Pointer(this.handle.add(offset), this.elementType);
        }, lazy);
        return this.elements;
      }
      /** Gets the size of the object encompassed by the current array. */
      get elementSize() {
        return this.elementType.class.arrayElementSize;
      }
      /** Gets the type of the object encompassed by the current array. */
      get elementType() {
        return this.object.class.type.class.baseType;
      }
      /** Gets the total number of elements in all the dimensions of the current array. */
      get length() {
        return Il2Cpp3.api.arrayGetLength(this);
      }
      /** Gets the encompassing object of the current array. */
      get object() {
        return new Il2Cpp3.Object(this);
      }
      /** Gets the element at the specified index of the current array. */
      get(index) {
        if (index < 0 || index >= this.length) {
          raise(`cannot get element at index ${index} as the array length is ${this.length}`);
        }
        return this.elements.get(index);
      }
      /** Sets the element at the specified index of the current array. */
      set(index, value) {
        if (index < 0 || index >= this.length) {
          raise(`cannot set element at index ${index} as the array length is ${this.length}`);
        }
        this.elements.set(index, value);
      }
      /** */
      toString() {
        return this.isNull() ? "null" : `[${this.elements.read(this.length, 0)}]`;
      }
      /** Iterable. */
      *[Symbol.iterator]() {
        for (let i = 0; i < this.length; i++) {
          yield this.elements.get(i);
        }
      }
    }
    __decorate([
      lazy
    ], Array2.prototype, "elementSize", null);
    __decorate([
      lazy
    ], Array2.prototype, "elementType", null);
    __decorate([
      lazy
    ], Array2.prototype, "length", null);
    __decorate([
      lazy
    ], Array2.prototype, "object", null);
    __decorate([
      lazy
    ], Array2, "headerSize", null);
    Il2Cpp3.Array = Array2;
    function array(klass, lengthOrElements) {
      const length = typeof lengthOrElements == "number" ? lengthOrElements : lengthOrElements.length;
      const array2 = new Il2Cpp3.Array(Il2Cpp3.api.arrayNew(klass, length));
      if (globalThis.Array.isArray(lengthOrElements)) {
        array2.elements.write(lengthOrElements);
      }
      return array2;
    }
    Il2Cpp3.array = array;
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    let Assembly = class Assembly extends NativeStruct {
      /** Gets the image of this assembly. */
      get image() {
        let get = function() {
          return new Il2Cpp3.Image(Il2Cpp3.api.assemblyGetImage(this));
        };
        try {
          Il2Cpp3.api.assemblyGetImage;
        } catch (_) {
          get = function() {
            return new Il2Cpp3.Image(this.object.method("GetType", 1).invoke(Il2Cpp3.string("<Module>")).method("get_Module").invoke().field("_impl").value);
          };
        }
        getter(Il2Cpp3.Assembly.prototype, "image", get, lazy);
        return this.image;
      }
      /** Gets the name of this assembly. */
      get name() {
        return this.image.name.replace(".dll", "");
      }
      /** Gets the encompassing object of the current assembly. */
      get object() {
        for (const _ of Il2Cpp3.domain.object.method("GetAssemblies", 1).invoke(false)) {
          if (_.field("_mono_assembly").value.equals(this)) {
            return _;
          }
        }
        raise("couldn't find the object of the native assembly struct");
      }
    };
    __decorate([
      lazy
    ], Assembly.prototype, "name", null);
    __decorate([
      lazy
    ], Assembly.prototype, "object", null);
    Assembly = __decorate([
      recycle
    ], Assembly);
    Il2Cpp3.Assembly = Assembly;
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    let Class = class Class extends NativeStruct {
      /** Gets the actual size of the instance of the current class. */
      get actualInstanceSize() {
        const SystemString = Il2Cpp3.corlib.class("System.String");
        const offset = SystemString.handle.offsetOf((_) => _.readInt() == SystemString.instanceSize - 2) ?? raise("couldn't find the actual instance size offset in the native class struct");
        getter(Il2Cpp3.Class.prototype, "actualInstanceSize", function() {
          return this.handle.add(offset).readS32();
        }, lazy);
        return this.actualInstanceSize;
      }
      /** Gets the array class which encompass the current class. */
      get arrayClass() {
        return new Il2Cpp3.Class(Il2Cpp3.api.classGetArrayClass(this, 1));
      }
      /** Gets the size of the object encompassed by the current array class. */
      get arrayElementSize() {
        return Il2Cpp3.api.classGetArrayElementSize(this);
      }
      /** Gets the name of the assembly in which the current class is defined. */
      get assemblyName() {
        return Il2Cpp3.api.classGetAssemblyName(this).readUtf8String().replace(".dll", "");
      }
      /** Gets the class that declares the current nested class. */
      get declaringClass() {
        return new Il2Cpp3.Class(Il2Cpp3.api.classGetDeclaringType(this)).asNullable();
      }
      /** Gets the encompassed type of this array, reference, pointer or enum type. */
      get baseType() {
        return new Il2Cpp3.Type(Il2Cpp3.api.classGetBaseType(this)).asNullable();
      }
      /** Gets the class of the object encompassed or referred to by the current array, pointer or reference class. */
      get elementClass() {
        return new Il2Cpp3.Class(Il2Cpp3.api.classGetElementClass(this)).asNullable();
      }
      /** Gets the fields of the current class. */
      get fields() {
        return readNativeIterator((_) => Il2Cpp3.api.classGetFields(this, _)).map((_) => new Il2Cpp3.Field(_));
      }
      /** Gets the flags of the current class. */
      get flags() {
        return Il2Cpp3.api.classGetFlags(this);
      }
      /** Gets the full name (namespace + name) of the current class. */
      get fullName() {
        return this.namespace ? `${this.namespace}.${this.name}` : this.name;
      }
      /** Gets the generics parameters of this generic class. */
      get generics() {
        if (!this.isGeneric && !this.isInflated) {
          return [];
        }
        const types = this.type.object.method("GetGenericArguments").invoke();
        return globalThis.Array.from(types).map((_) => new Il2Cpp3.Class(Il2Cpp3.api.classFromObject(_)));
      }
      /** Determines whether the GC has tracking references to the current class instances. */
      get hasReferences() {
        return !!Il2Cpp3.api.classHasReferences(this);
      }
      /** Determines whether ther current class has a valid static constructor. */
      get hasStaticConstructor() {
        const staticConstructor = this.tryMethod(".cctor");
        return staticConstructor != null && !staticConstructor.virtualAddress.isNull();
      }
      /** Gets the image in which the current class is defined. */
      get image() {
        return new Il2Cpp3.Image(Il2Cpp3.api.classGetImage(this));
      }
      /** Gets the size of the instance of the current class. */
      get instanceSize() {
        return Il2Cpp3.api.classGetInstanceSize(this);
      }
      /** Determines whether the current class is abstract. */
      get isAbstract() {
        return !!Il2Cpp3.api.classIsAbstract(this);
      }
      /** Determines whether the current class is blittable. */
      get isBlittable() {
        return !!Il2Cpp3.api.classIsBlittable(this);
      }
      /** Determines whether the current class is an enumeration. */
      get isEnum() {
        return !!Il2Cpp3.api.classIsEnum(this);
      }
      /** Determines whether the current class is a generic one. */
      get isGeneric() {
        return !!Il2Cpp3.api.classIsGeneric(this);
      }
      /** Determines whether the current class is inflated. */
      get isInflated() {
        return !!Il2Cpp3.api.classIsInflated(this);
      }
      /** Determines whether the current class is an interface. */
      get isInterface() {
        return !!Il2Cpp3.api.classIsInterface(this);
      }
      /** Determines whether the current class is a struct. */
      get isStruct() {
        return this.isValueType && !this.isEnum;
      }
      /** Determines whether the current class is a value type. */
      get isValueType() {
        return !!Il2Cpp3.api.classIsValueType(this);
      }
      /** Gets the interfaces implemented or inherited by the current class. */
      get interfaces() {
        return readNativeIterator((_) => Il2Cpp3.api.classGetInterfaces(this, _)).map((_) => new Il2Cpp3.Class(_));
      }
      /** Gets the methods implemented by the current class. */
      get methods() {
        return readNativeIterator((_) => Il2Cpp3.api.classGetMethods(this, _)).map((_) => new Il2Cpp3.Method(_));
      }
      /** Gets the name of the current class. */
      get name() {
        return Il2Cpp3.api.classGetName(this).readUtf8String();
      }
      /** Gets the namespace of the current class. */
      get namespace() {
        return Il2Cpp3.api.classGetNamespace(this).readUtf8String();
      }
      /** Gets the classes nested inside the current class. */
      get nestedClasses() {
        return readNativeIterator((_) => Il2Cpp3.api.classGetNestedClasses(this, _)).map((_) => new Il2Cpp3.Class(_));
      }
      /** Gets the class from which the current class directly inherits. */
      get parent() {
        return new Il2Cpp3.Class(Il2Cpp3.api.classGetParent(this)).asNullable();
      }
      /** Gets the rank (number of dimensions) of the current array class. */
      get rank() {
        let rank = 0;
        const name = this.name;
        for (let i = this.name.length - 1; i > 0; i--) {
          const c = name[i];
          if (c == "]")
            rank++;
          else if (c == "[" || rank == 0)
            break;
          else if (c == ",")
            rank++;
          else
            break;
        }
        return rank;
      }
      /** Gets a pointer to the static fields of the current class. */
      get staticFieldsData() {
        return Il2Cpp3.api.classGetStaticFieldData(this);
      }
      /** Gets the size of the instance - as a value type - of the current class. */
      get valueTypeSize() {
        return Il2Cpp3.api.classGetValueTypeSize(this, NULL);
      }
      /** Gets the type of the current class. */
      get type() {
        return new Il2Cpp3.Type(Il2Cpp3.api.classGetType(this));
      }
      /** Allocates a new object of the current class. */
      alloc() {
        return new Il2Cpp3.Object(Il2Cpp3.api.objectNew(this));
      }
      /** Gets the field identified by the given name. */
      field(name) {
        return this.tryField(name) ?? raise(`couldn't find field ${name} in class ${this.type.name}`);
      }
      /** Builds a generic instance of the current generic class. */
      inflate(...classes) {
        if (!this.isGeneric) {
          raise(`cannot inflate class ${this.type.name} as it has no generic parameters`);
        }
        if (this.generics.length != classes.length) {
          raise(`cannot inflate class ${this.type.name} as it needs ${this.generics.length} generic parameter(s), not ${classes.length}`);
        }
        const types = classes.map((_) => _.type.object);
        const typeArray = Il2Cpp3.array(Il2Cpp3.corlib.class("System.Type"), types);
        const inflatedType = this.type.object.method("MakeGenericType", 1).invoke(typeArray);
        return new Il2Cpp3.Class(Il2Cpp3.api.classFromObject(inflatedType));
      }
      /** Calls the static constructor of the current class. */
      initialize() {
        Il2Cpp3.api.classInitialize(this);
        return this;
      }
      /** Determines whether an instance of `other` class can be assigned to a variable of the current type. */
      isAssignableFrom(other) {
        return !!Il2Cpp3.api.classIsAssignableFrom(this, other);
      }
      /** Determines whether the current class derives from `other` class. */
      isSubclassOf(other, checkInterfaces) {
        return !!Il2Cpp3.api.classIsSubclassOf(this, other, +checkInterfaces);
      }
      /** Gets the method identified by the given name and parameter count. */
      method(name, parameterCount = -1) {
        return this.tryMethod(name, parameterCount) ?? raise(`couldn't find method ${name} in class ${this.type.name}`);
      }
      /** Gets the nested class with the given name. */
      nested(name) {
        return this.tryNested(name) ?? raise(`couldn't find nested class ${name} in class ${this.type.name}`);
      }
      /** Allocates a new object of the current class and calls its default constructor. */
      new() {
        const object = this.alloc();
        const exceptionArray = Memory.alloc(Process.pointerSize);
        Il2Cpp3.api.objectInitialize(object, exceptionArray);
        const exception = exceptionArray.readPointer();
        if (!exception.isNull()) {
          raise(new Il2Cpp3.Object(exception).toString());
        }
        return object;
      }
      /** Gets the field with the given name. */
      tryField(name) {
        return new Il2Cpp3.Field(Il2Cpp3.api.classGetFieldFromName(this, Memory.allocUtf8String(name))).asNullable();
      }
      /** Gets the method with the given name and parameter count. */
      tryMethod(name, parameterCount = -1) {
        return new Il2Cpp3.Method(Il2Cpp3.api.classGetMethodFromName(this, Memory.allocUtf8String(name), parameterCount)).asNullable();
      }
      /** Gets the nested class with the given name. */
      tryNested(name) {
        return this.nestedClasses.find((_) => _.name == name);
      }
      /** */
      toString() {
        const inherited = [this.parent].concat(this.interfaces);
        return `// ${this.assemblyName}
${this.isEnum ? `enum` : this.isStruct ? `struct` : this.isInterface ? `interface` : `class`} ${this.type.name}${inherited ? ` : ${inherited.map((_) => _?.type.name).join(`, `)}` : ``}
{
    ${this.fields.join(`
    `)}
    ${this.methods.join(`
    `)}
}`;
      }
      /** Executes a callback for every defined class. */
      static enumerate(block) {
        const callback = new NativeCallback((_) => block(new Il2Cpp3.Class(_)), "void", ["pointer", "pointer"]);
        return Il2Cpp3.api.classForEach(callback, NULL);
      }
    };
    __decorate([
      lazy
    ], Class.prototype, "arrayClass", null);
    __decorate([
      lazy
    ], Class.prototype, "arrayElementSize", null);
    __decorate([
      lazy
    ], Class.prototype, "assemblyName", null);
    __decorate([
      lazy
    ], Class.prototype, "declaringClass", null);
    __decorate([
      lazy
    ], Class.prototype, "baseType", null);
    __decorate([
      lazy
    ], Class.prototype, "elementClass", null);
    __decorate([
      lazy
    ], Class.prototype, "fields", null);
    __decorate([
      lazy
    ], Class.prototype, "flags", null);
    __decorate([
      lazy
    ], Class.prototype, "fullName", null);
    __decorate([
      lazy
    ], Class.prototype, "generics", null);
    __decorate([
      lazy
    ], Class.prototype, "hasReferences", null);
    __decorate([
      lazy
    ], Class.prototype, "hasStaticConstructor", null);
    __decorate([
      lazy
    ], Class.prototype, "image", null);
    __decorate([
      lazy
    ], Class.prototype, "instanceSize", null);
    __decorate([
      lazy
    ], Class.prototype, "isAbstract", null);
    __decorate([
      lazy
    ], Class.prototype, "isBlittable", null);
    __decorate([
      lazy
    ], Class.prototype, "isEnum", null);
    __decorate([
      lazy
    ], Class.prototype, "isGeneric", null);
    __decorate([
      lazy
    ], Class.prototype, "isInflated", null);
    __decorate([
      lazy
    ], Class.prototype, "isInterface", null);
    __decorate([
      lazy
    ], Class.prototype, "isValueType", null);
    __decorate([
      lazy
    ], Class.prototype, "interfaces", null);
    __decorate([
      lazy
    ], Class.prototype, "methods", null);
    __decorate([
      lazy
    ], Class.prototype, "name", null);
    __decorate([
      lazy
    ], Class.prototype, "namespace", null);
    __decorate([
      lazy
    ], Class.prototype, "nestedClasses", null);
    __decorate([
      lazy
    ], Class.prototype, "parent", null);
    __decorate([
      lazy
    ], Class.prototype, "rank", null);
    __decorate([
      lazy
    ], Class.prototype, "staticFieldsData", null);
    __decorate([
      lazy
    ], Class.prototype, "valueTypeSize", null);
    __decorate([
      lazy
    ], Class.prototype, "type", null);
    Class = __decorate([
      recycle
    ], Class);
    Il2Cpp3.Class = Class;
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    function delegate(klass, block) {
      const SystemDelegate = Il2Cpp3.corlib.class("System.Delegate");
      const SystemMulticastDelegate = Il2Cpp3.corlib.class("System.MulticastDelegate");
      if (!SystemDelegate.isAssignableFrom(klass)) {
        raise(`cannot create a delegate for ${klass.type.name} as it's a non-delegate class`);
      }
      if (klass.equals(SystemDelegate) || klass.equals(SystemMulticastDelegate)) {
        raise(`cannot create a delegate for neither ${SystemDelegate.type.name} nor ${SystemMulticastDelegate.type.name}, use a subclass instead`);
      }
      const delegate2 = klass.alloc();
      const key = delegate2.handle.toString();
      const Invoke = delegate2.tryMethod("Invoke") ?? raise(`cannot create a delegate for ${klass.type.name}, there is no Invoke method`);
      delegate2.method(".ctor").invoke(delegate2, Invoke.handle);
      const callback = Invoke.wrap(block);
      delegate2.field("method_ptr").value = callback;
      delegate2.field("invoke_impl").value = callback;
      Il2Cpp3._callbacksToKeepAlive[key] = callback;
      return delegate2;
    }
    Il2Cpp3.delegate = delegate;
    Il2Cpp3._callbacksToKeepAlive = {};
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    let Domain = class Domain extends NativeStruct {
      /** Gets the assemblies that have been loaded into the execution context of the application domain. */
      get assemblies() {
        let handles = readNativeList((_) => Il2Cpp3.api.domainGetAssemblies(this, _));
        if (handles.length == 0) {
          const assemblyObjects = this.object.method("GetAssemblies").overload().invoke();
          handles = globalThis.Array.from(assemblyObjects).map((_) => _.field("_mono_assembly").value);
        }
        return handles.map((_) => new Il2Cpp3.Assembly(_));
      }
      /** Gets the encompassing object of the application domain. */
      get object() {
        return Il2Cpp3.corlib.class("System.AppDomain").method("get_CurrentDomain").invoke();
      }
      /** Opens and loads the assembly with the given name. */
      assembly(name) {
        return this.tryAssembly(name) ?? raise(`couldn't find assembly ${name}`);
      }
      /** Attached a new thread to the application domain. */
      attach() {
        return new Il2Cpp3.Thread(Il2Cpp3.api.threadAttach(this));
      }
      /** Opens and loads the assembly with the given name. */
      tryAssembly(name) {
        return new Il2Cpp3.Assembly(Il2Cpp3.api.domainGetAssemblyFromName(this, Memory.allocUtf8String(name))).asNullable();
      }
    };
    __decorate([
      lazy
    ], Domain.prototype, "assemblies", null);
    __decorate([
      lazy
    ], Domain.prototype, "object", null);
    Domain = __decorate([
      recycle
    ], Domain);
    Il2Cpp3.Domain = Domain;
    getter(Il2Cpp3, "domain", () => {
      return new Il2Cpp3.Domain(Il2Cpp3.api.domainGet());
    }, lazy);
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    class Field extends NativeStruct {
      /** Gets the class in which this field is defined. */
      get class() {
        return new Il2Cpp3.Class(Il2Cpp3.api.fieldGetClass(this));
      }
      /** Gets the flags of the current field. */
      get flags() {
        return Il2Cpp3.api.fieldGetFlags(this);
      }
      /** Determines whether this field value is known at compile time. */
      get isLiteral() {
        return (this.flags & 64) != 0;
      }
      /** Determines whether this field is static. */
      get isStatic() {
        return (this.flags & 16) != 0;
      }
      /** Determines whether this field is thread static. */
      get isThreadStatic() {
        const offset = Il2Cpp3.corlib.class("System.AppDomain").field("type_resolve_in_progress").offset;
        getter(Il2Cpp3.Field.prototype, "isThreadStatic", function() {
          return this.offset == offset;
        }, lazy);
        return this.isThreadStatic;
      }
      /** Gets the access modifier of this field. */
      get modifier() {
        switch (this.flags & 7) {
          case 1:
            return "private";
          case 2:
            return "private protected";
          case 3:
            return "internal";
          case 4:
            return "protected";
          case 5:
            return "protected internal";
          case 6:
            return "public";
        }
      }
      /** Gets the name of this field. */
      get name() {
        return Il2Cpp3.api.fieldGetName(this).readUtf8String();
      }
      /** Gets the offset of this field, calculated as the difference with its owner virtual address. */
      get offset() {
        return Il2Cpp3.api.fieldGetOffset(this);
      }
      /** Gets the type of this field. */
      get type() {
        return new Il2Cpp3.Type(Il2Cpp3.api.fieldGetType(this));
      }
      /** Gets the value of this field. */
      get value() {
        if (!this.isStatic) {
          raise(`cannot access instance field ${this.class.type.name}::${this.name} from a class, use an object instead`);
        }
        const handle = Memory.alloc(Process.pointerSize);
        Il2Cpp3.api.fieldGetStaticValue(this.handle, handle);
        return Il2Cpp3.read(handle, this.type);
      }
      /** Sets the value of this field. Thread static or literal values cannot be altered yet. */
      set value(value) {
        if (!this.isStatic) {
          raise(`cannot access instance field ${this.class.type.name}::${this.name} from a class, use an object instead`);
        }
        if (this.isThreadStatic || this.isLiteral) {
          raise(`cannot write the value of field ${this.name} as it's thread static or literal`);
        }
        const handle = (
          // pointer-like values should be passed as-is, but boxed
          // value types (primitives included) must be unboxed first
          value instanceof Il2Cpp3.Object && this.type.class.isValueType ? value.unbox() : value instanceof NativeStruct ? value.handle : value instanceof NativePointer ? value : Il2Cpp3.write(Memory.alloc(this.type.class.valueTypeSize), value, this.type)
        );
        Il2Cpp3.api.fieldSetStaticValue(this.handle, handle);
      }
      /** */
      toString() {
        return `${this.isThreadStatic ? `[ThreadStatic] ` : ``}${this.isStatic ? `static ` : ``}${this.type.name} ${this.name}${this.isLiteral ? ` = ${this.type.class.isEnum ? Il2Cpp3.read(this.value.handle, this.type.class.baseType) : this.value}` : ``};${this.isThreadStatic || this.isLiteral ? `` : ` // 0x${this.offset.toString(16)}`}`;
      }
      /** @internal */
      withHolder(instance) {
        if (this.isStatic) {
          raise(`cannot access static field ${this.class.type.name}::${this.name} from an object, use a class instead`);
        }
        const valueHandle = instance.handle.add(this.offset - (instance instanceof Il2Cpp3.ValueType ? Il2Cpp3.Object.headerSize : 0));
        return new Proxy(this, {
          get(target, property) {
            if (property == "value") {
              return Il2Cpp3.read(valueHandle, target.type);
            }
            return Reflect.get(target, property);
          },
          set(target, property, value) {
            if (property == "value") {
              Il2Cpp3.write(valueHandle, value, target.type);
              return true;
            }
            return Reflect.set(target, property, value);
          }
        });
      }
    }
    __decorate([
      lazy
    ], Field.prototype, "class", null);
    __decorate([
      lazy
    ], Field.prototype, "flags", null);
    __decorate([
      lazy
    ], Field.prototype, "isLiteral", null);
    __decorate([
      lazy
    ], Field.prototype, "isStatic", null);
    __decorate([
      lazy
    ], Field.prototype, "isThreadStatic", null);
    __decorate([
      lazy
    ], Field.prototype, "modifier", null);
    __decorate([
      lazy
    ], Field.prototype, "name", null);
    __decorate([
      lazy
    ], Field.prototype, "offset", null);
    __decorate([
      lazy
    ], Field.prototype, "type", null);
    Il2Cpp3.Field = Field;
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    class GCHandle {
      handle;
      /** @internal */
      constructor(handle) {
        this.handle = handle;
      }
      /** Gets the object associated to this handle. */
      get target() {
        return new Il2Cpp3.Object(Il2Cpp3.api.gcHandleGetTarget(this.handle)).asNullable();
      }
      /** Frees this handle. */
      free() {
        return Il2Cpp3.api.gcHandleFree(this.handle);
      }
    }
    Il2Cpp3.GCHandle = GCHandle;
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    let Image = class Image extends NativeStruct {
      /** Gets the assembly in which the current image is defined. */
      get assembly() {
        return new Il2Cpp3.Assembly(Il2Cpp3.api.imageGetAssembly(this));
      }
      /** Gets the amount of classes defined in this image. */
      get classCount() {
        if (Il2Cpp3.unityVersionIsBelow201830) {
          return this.classes.length;
        } else {
          return Il2Cpp3.api.imageGetClassCount(this);
        }
      }
      /** Gets the classes defined in this image. */
      get classes() {
        if (Il2Cpp3.unityVersionIsBelow201830) {
          const types = this.assembly.object.method("GetTypes").invoke(false);
          const classes = globalThis.Array.from(types, (_) => new Il2Cpp3.Class(Il2Cpp3.api.classFromObject(_)));
          classes.unshift(this.class("<Module>"));
          return classes;
        } else {
          return globalThis.Array.from(globalThis.Array(this.classCount), (_, i) => new Il2Cpp3.Class(Il2Cpp3.api.imageGetClass(this, i)));
        }
      }
      /** Gets the name of this image. */
      get name() {
        return Il2Cpp3.api.imageGetName(this).readUtf8String();
      }
      /** Gets the class with the specified name defined in this image. */
      class(name) {
        return this.tryClass(name) ?? raise(`couldn't find class ${name} in assembly ${this.name}`);
      }
      /** Gets the class with the specified name defined in this image. */
      tryClass(name) {
        const dotIndex = name.lastIndexOf(".");
        const classNamespace = Memory.allocUtf8String(dotIndex == -1 ? "" : name.slice(0, dotIndex));
        const className = Memory.allocUtf8String(name.slice(dotIndex + 1));
        return new Il2Cpp3.Class(Il2Cpp3.api.classFromName(this, classNamespace, className)).asNullable();
      }
    };
    __decorate([
      lazy
    ], Image.prototype, "assembly", null);
    __decorate([
      lazy
    ], Image.prototype, "classCount", null);
    __decorate([
      lazy
    ], Image.prototype, "classes", null);
    __decorate([
      lazy
    ], Image.prototype, "name", null);
    Image = __decorate([
      recycle
    ], Image);
    Il2Cpp3.Image = Image;
    getter(Il2Cpp3, "corlib", () => {
      return new Il2Cpp3.Image(Il2Cpp3.api.getCorlib());
    }, lazy);
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    class MemorySnapshot extends NativeStruct {
      /** Captures a memory snapshot. */
      static capture() {
        return new Il2Cpp3.MemorySnapshot();
      }
      /** Creates a memory snapshot with the given handle. */
      constructor(handle = Il2Cpp3.api.memorySnapshotCapture()) {
        super(handle);
      }
      /** Gets any initialized class. */
      get classes() {
        return readNativeIterator((_) => Il2Cpp3.api.memorySnapshotGetClasses(this, _)).map((_) => new Il2Cpp3.Class(_));
      }
      /** Gets the objects tracked by this memory snapshot. */
      get objects() {
        return readNativeList((_) => Il2Cpp3.api.memorySnapshotGetObjects(this, _)).filter((_) => !_.isNull()).map((_) => new Il2Cpp3.Object(_));
      }
      /** Frees this memory snapshot. */
      free() {
        Il2Cpp3.api.memorySnapshotFree(this);
      }
    }
    __decorate([
      lazy
    ], MemorySnapshot.prototype, "classes", null);
    __decorate([
      lazy
    ], MemorySnapshot.prototype, "objects", null);
    Il2Cpp3.MemorySnapshot = MemorySnapshot;
    function memorySnapshot(block) {
      const memorySnapshot2 = Il2Cpp3.MemorySnapshot.capture();
      const result = block(memorySnapshot2);
      memorySnapshot2.free();
      return result;
    }
    Il2Cpp3.memorySnapshot = memorySnapshot;
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    class Method extends NativeStruct {
      /** Gets the class in which this method is defined. */
      get class() {
        return new Il2Cpp3.Class(Il2Cpp3.api.methodGetClass(this));
      }
      /** Gets the flags of the current method. */
      get flags() {
        return Il2Cpp3.api.methodGetFlags(this, NULL);
      }
      /** Gets the implementation flags of the current method. */
      get implementationFlags() {
        const implementationFlagsPointer = Memory.alloc(Process.pointerSize);
        Il2Cpp3.api.methodGetFlags(this, implementationFlagsPointer);
        return implementationFlagsPointer.readU32();
      }
      /** */
      get fridaSignature() {
        const types = [];
        for (const parameter of this.parameters) {
          types.push(parameter.type.fridaAlias);
        }
        if (!this.isStatic || Il2Cpp3.unityVersionIsBelow201830) {
          types.unshift("pointer");
        }
        if (this.isInflated) {
          types.push("pointer");
        }
        return types;
      }
      /** Gets the generic parameters of this generic method. */
      get generics() {
        if (!this.isGeneric && !this.isInflated) {
          return [];
        }
        const types = this.object.method("GetGenericArguments").invoke();
        return globalThis.Array.from(types).map((_) => new Il2Cpp3.Class(Il2Cpp3.api.classFromObject(_)));
      }
      /** Determines whether this method is external. */
      get isExternal() {
        return (this.implementationFlags & 4096) != 0;
      }
      /** Determines whether this method is generic. */
      get isGeneric() {
        return !!Il2Cpp3.api.methodIsGeneric(this);
      }
      /** Determines whether this method is inflated (generic with a concrete type parameter). */
      get isInflated() {
        return !!Il2Cpp3.api.methodIsInflated(this);
      }
      /** Determines whether this method is static. */
      get isStatic() {
        return !Il2Cpp3.api.methodIsInstance(this);
      }
      /** Determines whether this method is synchronized. */
      get isSynchronized() {
        return (this.implementationFlags & 32) != 0;
      }
      /** Gets the access modifier of this method. */
      get modifier() {
        switch (this.flags & 7) {
          case 1:
            return "private";
          case 2:
            return "private protected";
          case 3:
            return "internal";
          case 4:
            return "protected";
          case 5:
            return "protected internal";
          case 6:
            return "public";
        }
      }
      /** Gets the name of this method. */
      get name() {
        return Il2Cpp3.api.methodGetName(this).readUtf8String();
      }
      /** @internal */
      get nativeFunction() {
        return new NativeFunction(this.virtualAddress, this.returnType.fridaAlias, this.fridaSignature);
      }
      /** Gets the encompassing object of the current method. */
      get object() {
        return new Il2Cpp3.Object(Il2Cpp3.api.methodGetObject(this, NULL));
      }
      /** Gets the amount of parameters of this method. */
      get parameterCount() {
        return Il2Cpp3.api.methodGetParameterCount(this);
      }
      /** Gets the parameters of this method. */
      get parameters() {
        return globalThis.Array.from(globalThis.Array(this.parameterCount), (_, i) => {
          const parameterName = Il2Cpp3.api.methodGetParameterName(this, i).readUtf8String();
          const parameterType = Il2Cpp3.api.methodGetParameterType(this, i);
          return new Il2Cpp3.Parameter(parameterName, i, new Il2Cpp3.Type(parameterType));
        });
      }
      /** Gets the relative virtual address (RVA) of this method. */
      get relativeVirtualAddress() {
        return this.virtualAddress.sub(Il2Cpp3.module.base);
      }
      /** Gets the return type of this method. */
      get returnType() {
        return new Il2Cpp3.Type(Il2Cpp3.api.methodGetReturnType(this));
      }
      /** Gets the virtual address (VA) of this method. */
      get virtualAddress() {
        const FilterTypeName = Il2Cpp3.corlib.class("System.Reflection.Module").initialize().field("FilterTypeName").value;
        const FilterTypeNameMethodPointer = FilterTypeName.field("method_ptr").value;
        const FilterTypeNameMethod = FilterTypeName.field("method").value;
        const offset = FilterTypeNameMethod.offsetOf((_) => _.readPointer().equals(FilterTypeNameMethodPointer)) ?? raise("couldn't find the virtual address offset in the native method struct");
        getter(Il2Cpp3.Method.prototype, "virtualAddress", function() {
          return this.handle.add(offset).readPointer();
        }, lazy);
        Il2Cpp3.corlib.class("System.Reflection.Module").method(".cctor").invoke();
        return this.virtualAddress;
      }
      /** Replaces the body of this method. */
      set implementation(block) {
        try {
          Interceptor.replace(this.virtualAddress, this.wrap(block));
        } catch (e) {
          switch (e.message) {
            case "access violation accessing 0x0":
              raise(`couldn't set implementation for method ${this.name} as it has a NULL virtual address`);
            case /unable to intercept function at \w+; please file a bug/.exec(e.message)?.input:
              warn(`couldn't set implementation for method ${this.name} as it may be a thunk`);
              break;
            case "already replaced this function":
              warn(`couldn't set implementation for method ${this.name} as it has already been replaced by a thunk`);
              break;
            default:
              throw e;
          }
        }
      }
      /** Creates a generic instance of the current generic method. */
      inflate(...classes) {
        if (!this.isGeneric) {
          raise(`cannot inflate method ${this.name} as it has no generic parameters`);
        }
        if (this.generics.length != classes.length) {
          raise(`cannot inflate method ${this.name} as it needs ${this.generics.length} generic parameter(s), not ${classes.length}`);
        }
        const types = classes.map((_) => _.type.object);
        const typeArray = Il2Cpp3.array(Il2Cpp3.corlib.class("System.Type"), types);
        const inflatedMethodObject = this.object.method("MakeGenericMethod", 1).invoke(typeArray);
        return new Il2Cpp3.Method(inflatedMethodObject.field("mhandle").value);
      }
      /** Invokes this method. */
      invoke(...parameters) {
        if (!this.isStatic) {
          raise(`cannot invoke non-static method ${this.name} as it must be invoked throught a Il2Cpp.Object, not a Il2Cpp.Class`);
        }
        return this.invokeRaw(NULL, ...parameters);
      }
      /** @internal */
      invokeRaw(instance, ...parameters) {
        const allocatedParameters = parameters.map(Il2Cpp3.toFridaValue);
        if (!this.isStatic || Il2Cpp3.unityVersionIsBelow201830) {
          allocatedParameters.unshift(instance);
        }
        if (this.isInflated) {
          allocatedParameters.push(this.handle);
        }
        try {
          const returnValue = this.nativeFunction(...allocatedParameters);
          return Il2Cpp3.fromFridaValue(returnValue, this.returnType);
        } catch (e) {
          if (e == null) {
            raise("an unexpected native invocation exception occurred, this is due to parameter types mismatch");
          }
          switch (e.message) {
            case "bad argument count":
              raise(`couldn't invoke method ${this.name} as it needs ${this.parameterCount} parameter(s), not ${parameters.length}`);
            case "expected a pointer":
            case "expected number":
            case "expected array with fields":
              raise(`couldn't invoke method ${this.name} using incorrect parameter types`);
          }
          throw e;
        }
      }
      /** Gets the overloaded method with the given parameter types. */
      overload(...parameterTypes) {
        const result = this.tryOverload(...parameterTypes);
        if (result != void 0)
          return result;
        raise(`couldn't find overloaded method ${this.name}(${parameterTypes})`);
      }
      /** Gets the parameter with the given name. */
      parameter(name) {
        return this.tryParameter(name) ?? raise(`couldn't find parameter ${name} in method ${this.name}`);
      }
      /** Restore the original method implementation. */
      revert() {
        Interceptor.revert(this.virtualAddress);
        Interceptor.flush();
      }
      /** Gets the overloaded method with the given parameter types. */
      tryOverload(...parameterTypes) {
        return this.class.methods.find((method) => {
          return method.name == this.name && method.parameterCount == parameterTypes.length && method.parameters.every((e, i) => e.type.name == parameterTypes[i]);
        });
      }
      /** Gets the parameter with the given name. */
      tryParameter(name) {
        return this.parameters.find((_) => _.name == name);
      }
      /** */
      toString() {
        return `${this.isStatic ? `static ` : ``}${this.returnType.name} ${this.name}(${this.parameters.join(`, `)});${this.virtualAddress.isNull() ? `` : ` // 0x${this.relativeVirtualAddress.toString(16).padStart(8, `0`)}`}`;
      }
      /** @internal */
      withHolder(instance) {
        if (this.isStatic) {
          raise(`cannot access static method ${this.class.type.name}::${this.name} from an object, use a class instead`);
        }
        return new Proxy(this, {
          get(target, property) {
            switch (property) {
              case "invoke":
                const handle = instance instanceof Il2Cpp3.ValueType ? target.class.isValueType ? instance.handle.add(maybeObjectHeaderSize() - Il2Cpp3.Object.headerSize) : raise(`cannot invoke method ${target.class.type.name}::${target.name} against a value type, you must box it first`) : target.class.isValueType ? instance.handle.add(maybeObjectHeaderSize()) : instance.handle;
                return target.invokeRaw.bind(target, handle);
              case "inflate":
              case "overload":
              case "tryOverload":
                return function(...args) {
                  return target[property](...args)?.withHolder(instance);
                };
            }
            return Reflect.get(target, property);
          }
        });
      }
      /** @internal */
      wrap(block) {
        const startIndex = +!this.isStatic | +Il2Cpp3.unityVersionIsBelow201830;
        return new NativeCallback((...args) => {
          const thisObject = this.isStatic ? this.class : this.class.isValueType ? new Il2Cpp3.ValueType(args[0].add(Il2Cpp3.Object.headerSize - maybeObjectHeaderSize()), this.class.type) : new Il2Cpp3.Object(args[0]);
          const parameters = this.parameters.map((_, i) => Il2Cpp3.fromFridaValue(args[i + startIndex], _.type));
          const result = block.call(thisObject, ...parameters);
          return Il2Cpp3.toFridaValue(result);
        }, this.returnType.fridaAlias, this.fridaSignature);
      }
    }
    __decorate([
      lazy
    ], Method.prototype, "class", null);
    __decorate([
      lazy
    ], Method.prototype, "flags", null);
    __decorate([
      lazy
    ], Method.prototype, "implementationFlags", null);
    __decorate([
      lazy
    ], Method.prototype, "fridaSignature", null);
    __decorate([
      lazy
    ], Method.prototype, "generics", null);
    __decorate([
      lazy
    ], Method.prototype, "isExternal", null);
    __decorate([
      lazy
    ], Method.prototype, "isGeneric", null);
    __decorate([
      lazy
    ], Method.prototype, "isInflated", null);
    __decorate([
      lazy
    ], Method.prototype, "isStatic", null);
    __decorate([
      lazy
    ], Method.prototype, "isSynchronized", null);
    __decorate([
      lazy
    ], Method.prototype, "modifier", null);
    __decorate([
      lazy
    ], Method.prototype, "name", null);
    __decorate([
      lazy
    ], Method.prototype, "nativeFunction", null);
    __decorate([
      lazy
    ], Method.prototype, "object", null);
    __decorate([
      lazy
    ], Method.prototype, "parameterCount", null);
    __decorate([
      lazy
    ], Method.prototype, "parameters", null);
    __decorate([
      lazy
    ], Method.prototype, "relativeVirtualAddress", null);
    __decorate([
      lazy
    ], Method.prototype, "returnType", null);
    Il2Cpp3.Method = Method;
    let maybeObjectHeaderSize = () => {
      const struct = Il2Cpp3.corlib.class("System.RuntimeTypeHandle").initialize().alloc();
      struct.method(".ctor").invokeRaw(struct, ptr(3735928559));
      const offset = struct.field("value").value.equals(ptr(3735928559)) ? 0 : Il2Cpp3.Object.headerSize;
      return (maybeObjectHeaderSize = () => offset)();
    };
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    class Object2 extends NativeStruct {
      /** Gets the Il2CppObject struct size, possibly equal to `Process.pointerSize * 2`. */
      static get headerSize() {
        return Il2Cpp3.corlib.class("System.Object").instanceSize;
      }
      /** Gets the class of this object. */
      get class() {
        return new Il2Cpp3.Class(Il2Cpp3.api.objectGetClass(this));
      }
      /** Returns a monitor for this object. */
      get monitor() {
        return new Il2Cpp3.Object.Monitor(this);
      }
      /** Gets the size of the current object. */
      get size() {
        return Il2Cpp3.api.objectGetSize(this);
      }
      /** Gets the field with the given name. */
      field(name) {
        return this.class.field(name).withHolder(this);
      }
      /** Gets the method with the given name. */
      method(name, parameterCount = -1) {
        return this.class.method(name, parameterCount).withHolder(this);
      }
      /** Creates a reference to this object. */
      ref(pin) {
        return new Il2Cpp3.GCHandle(Il2Cpp3.api.gcHandleNew(this, +pin));
      }
      /** Gets the correct virtual method from the given virtual method. */
      virtualMethod(method) {
        return new Il2Cpp3.Method(Il2Cpp3.api.objectGetVirtualMethod(this, method)).withHolder(this);
      }
      /** Gets the field with the given name. */
      tryField(name) {
        return this.class.tryField(name)?.withHolder(this);
      }
      /** Gets the field with the given name. */
      tryMethod(name, parameterCount = -1) {
        return this.class.tryMethod(name, parameterCount)?.withHolder(this);
      }
      /** */
      toString() {
        return this.isNull() ? "null" : this.method("ToString", 0).invoke().content ?? "null";
      }
      /** Unboxes the value type (either a primitive, a struct or an enum) out of this object. */
      unbox() {
        return this.class.isValueType ? new Il2Cpp3.ValueType(Il2Cpp3.api.objectUnbox(this), this.class.type) : raise(`couldn't unbox instances of ${this.class.type.name} as they are not value types`);
      }
      /** Creates a weak reference to this object. */
      weakRef(trackResurrection) {
        return new Il2Cpp3.GCHandle(Il2Cpp3.api.gcHandleNewWeakRef(this, +trackResurrection));
      }
    }
    __decorate([
      lazy
    ], Object2.prototype, "class", null);
    __decorate([
      lazy
    ], Object2.prototype, "size", null);
    __decorate([
      lazy
    ], Object2, "headerSize", null);
    Il2Cpp3.Object = Object2;
    (function(Object3) {
      class Monitor {
        handle;
        /** @internal */
        constructor(handle) {
          this.handle = handle;
        }
        /** Acquires an exclusive lock on the current object. */
        enter() {
          return Il2Cpp3.api.monitorEnter(this.handle);
        }
        /** Release an exclusive lock on the current object. */
        exit() {
          return Il2Cpp3.api.monitorExit(this.handle);
        }
        /** Notifies a thread in the waiting queue of a change in the locked object's state. */
        pulse() {
          return Il2Cpp3.api.monitorPulse(this.handle);
        }
        /** Notifies all waiting threads of a change in the object's state. */
        pulseAll() {
          return Il2Cpp3.api.monitorPulseAll(this.handle);
        }
        /** Attempts to acquire an exclusive lock on the current object. */
        tryEnter(timeout) {
          return !!Il2Cpp3.api.monitorTryEnter(this.handle, timeout);
        }
        /** Releases the lock on an object and attempts to block the current thread until it reacquires the lock. */
        tryWait(timeout) {
          return !!Il2Cpp3.api.monitorTryWait(this.handle, timeout);
        }
        /** Releases the lock on an object and blocks the current thread until it reacquires the lock. */
        wait() {
          return Il2Cpp3.api.monitorWait(this.handle);
        }
      }
      Object3.Monitor = Monitor;
    })(Object2 = Il2Cpp3.Object || (Il2Cpp3.Object = {}));
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    class Parameter {
      /** Name of this parameter. */
      name;
      /** Position of this parameter. */
      position;
      /** Type of this parameter. */
      type;
      constructor(name, position, type) {
        this.name = name;
        this.position = position;
        this.type = type;
      }
      /** */
      toString() {
        return `${this.type.name} ${this.name}`;
      }
    }
    Il2Cpp3.Parameter = Parameter;
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    class Pointer extends NativeStruct {
      type;
      constructor(handle, type) {
        super(handle);
        this.type = type;
      }
      /** Gets the element at the given index. */
      get(index) {
        return Il2Cpp3.read(this.handle.add(index * this.type.class.arrayElementSize), this.type);
      }
      /** Reads the given amount of elements starting at the given offset. */
      read(length, offset = 0) {
        const values = new globalThis.Array(length);
        for (let i = 0; i < length; i++) {
          values[i] = this.get(i + offset);
        }
        return values;
      }
      /** Sets the given element at the given index */
      set(index, value) {
        Il2Cpp3.write(this.handle.add(index * this.type.class.arrayElementSize), value, this.type);
      }
      /** */
      toString() {
        return this.handle.toString();
      }
      /** Writes the given elements starting at the given index. */
      write(values, offset = 0) {
        for (let i = 0; i < values.length; i++) {
          this.set(i + offset, values[i]);
        }
      }
    }
    Il2Cpp3.Pointer = Pointer;
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    class Reference extends NativeStruct {
      type;
      constructor(handle, type) {
        super(handle);
        this.type = type;
      }
      /** Gets the element referenced by the current reference. */
      get value() {
        return Il2Cpp3.read(this.handle, this.type);
      }
      /** Sets the element referenced by the current reference. */
      set value(value) {
        Il2Cpp3.write(this.handle, value, this.type);
      }
      /** */
      toString() {
        return this.isNull() ? "null" : `->${this.value}`;
      }
    }
    Il2Cpp3.Reference = Reference;
    function reference(value, type) {
      const handle = Memory.alloc(Process.pointerSize);
      switch (typeof value) {
        case "boolean":
          return new Il2Cpp3.Reference(handle.writeS8(+value), Il2Cpp3.corlib.class("System.Boolean").type);
        case "number":
          switch (type?.typeEnum) {
            case Il2Cpp3.Type.enum.unsignedByte:
              return new Il2Cpp3.Reference(handle.writeU8(value), type);
            case Il2Cpp3.Type.enum.byte:
              return new Il2Cpp3.Reference(handle.writeS8(value), type);
            case Il2Cpp3.Type.enum.char:
            case Il2Cpp3.Type.enum.unsignedShort:
              return new Il2Cpp3.Reference(handle.writeU16(value), type);
            case Il2Cpp3.Type.enum.short:
              return new Il2Cpp3.Reference(handle.writeS16(value), type);
            case Il2Cpp3.Type.enum.unsignedInt:
              return new Il2Cpp3.Reference(handle.writeU32(value), type);
            case Il2Cpp3.Type.enum.int:
              return new Il2Cpp3.Reference(handle.writeS32(value), type);
            case Il2Cpp3.Type.enum.unsignedLong:
              return new Il2Cpp3.Reference(handle.writeU64(value), type);
            case Il2Cpp3.Type.enum.long:
              return new Il2Cpp3.Reference(handle.writeS64(value), type);
            case Il2Cpp3.Type.enum.float:
              return new Il2Cpp3.Reference(handle.writeFloat(value), type);
            case Il2Cpp3.Type.enum.double:
              return new Il2Cpp3.Reference(handle.writeDouble(value), type);
          }
        case "object":
          if (value instanceof Il2Cpp3.ValueType || value instanceof Il2Cpp3.Pointer) {
            return new Il2Cpp3.Reference(handle.writePointer(value), value.type);
          } else if (value instanceof Il2Cpp3.Object) {
            return new Il2Cpp3.Reference(handle.writePointer(value), value.class.type);
          } else if (value instanceof Il2Cpp3.String || value instanceof Il2Cpp3.Array) {
            return new Il2Cpp3.Reference(handle.writePointer(value), value.object.class.type);
          } else if (value instanceof NativePointer) {
            switch (type?.typeEnum) {
              case Il2Cpp3.Type.enum.unsignedNativePointer:
              case Il2Cpp3.Type.enum.nativePointer:
                return new Il2Cpp3.Reference(handle.writePointer(value), type);
            }
          } else if (value instanceof Int64) {
            return new Il2Cpp3.Reference(handle.writeS64(value), Il2Cpp3.corlib.class("System.Int64").type);
          } else if (value instanceof UInt64) {
            return new Il2Cpp3.Reference(handle.writeU64(value), Il2Cpp3.corlib.class("System.UInt64").type);
          }
        default:
          raise(`couldn't create a reference to ${value} using an unhandled type ${type?.name}`);
      }
    }
    Il2Cpp3.reference = reference;
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    class String extends NativeStruct {
      /** Gets the content of this string. */
      get content() {
        return Il2Cpp3.api.stringGetChars(this).readUtf16String(this.length);
      }
      /** @unsafe Sets the content of this string - it may write out of bounds! */
      set content(value) {
        const offset = Il2Cpp3.string("vfsfitvnm").handle.offsetOf((_) => _.readInt() == 9) ?? raise("couldn't find the length offset in the native string struct");
        globalThis.Object.defineProperty(Il2Cpp3.String.prototype, "content", {
          set(value2) {
            Il2Cpp3.api.stringGetChars(this).writeUtf16String(value2 ?? "");
            this.handle.add(offset).writeS32(value2?.length ?? 0);
          }
        });
        this.content = value;
      }
      /** Gets the length of this string. */
      get length() {
        return Il2Cpp3.api.stringGetLength(this);
      }
      /** Gets the encompassing object of the current string. */
      get object() {
        return new Il2Cpp3.Object(this);
      }
      /** */
      toString() {
        return this.isNull() ? "null" : `"${this.content}"`;
      }
    }
    Il2Cpp3.String = String;
    function string(content) {
      return new Il2Cpp3.String(Il2Cpp3.api.stringNew(Memory.allocUtf8String(content ?? "")));
    }
    Il2Cpp3.string = string;
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    class Thread extends NativeStruct {
      /** Gets the native id of the current thread. */
      get id() {
        let get = function() {
          return this.internal.field("thread_id").value.toNumber();
        };
        if (Process.platform != "windows") {
          const currentThreadId = Process.getCurrentThreadId();
          const currentPosixThread = ptr(get.apply(Il2Cpp3.currentThread));
          const offset = currentPosixThread.offsetOf((_) => _.readS32() == currentThreadId, 1024) ?? raise(`couldn't find the offset for determining the kernel id of a posix thread`);
          const _get = get;
          get = function() {
            return ptr(_get.apply(this)).add(offset).readS32();
          };
        }
        getter(Il2Cpp3.Thread.prototype, "id", get, lazy);
        return this.id;
      }
      /** Gets the encompassing internal object (System.Threding.InternalThreead) of the current thread. */
      get internal() {
        return this.object.tryField("internal_thread")?.value ?? this.object;
      }
      /** Determines whether the current thread is the garbage collector finalizer one. */
      get isFinalizer() {
        return !Il2Cpp3.api.threadIsVm(this);
      }
      /** Gets the managed id of the current thread. */
      get managedId() {
        return this.object.method("get_ManagedThreadId").invoke();
      }
      /** Gets the encompassing object of the current thread. */
      get object() {
        return new Il2Cpp3.Object(this);
      }
      /** @internal */
      get staticData() {
        return this.internal.field("static_data").value;
      }
      /** @internal */
      get synchronizationContext() {
        const get_ExecutionContext = this.object.tryMethod("GetMutableExecutionContext") ?? this.object.method("get_ExecutionContext");
        const executionContext = get_ExecutionContext.invoke();
        let synchronizationContext = executionContext.tryField("_syncContext")?.value ?? executionContext.tryMethod("get_SynchronizationContext")?.invoke() ?? this.tryLocalValue(Il2Cpp3.corlib.class("System.Threading.SynchronizationContext"));
        if (synchronizationContext == null || synchronizationContext.isNull()) {
          if (this.handle.equals(Il2Cpp3.mainThread.handle)) {
            raise(`couldn't find the synchronization context of the main thread, perhaps this is early instrumentation?`);
          } else {
            raise(`couldn't find the synchronization context of thread #${this.managedId}, only the main thread is expected to have one`);
          }
        }
        return synchronizationContext;
      }
      /** Detaches the thread from the application domain. */
      detach() {
        return Il2Cpp3.api.threadDetach(this);
      }
      /** Schedules a callback on the current thread. */
      schedule(block) {
        const Post = this.synchronizationContext.method("Post");
        return new Promise((resolve) => {
          const delegate = Il2Cpp3.delegate(Il2Cpp3.corlib.class("System.Threading.SendOrPostCallback"), () => {
            const result = block();
            setImmediate(() => resolve(result));
          });
          Script.bindWeak(globalThis, () => {
            delegate.field("method_ptr").value = delegate.field("invoke_impl").value = Il2Cpp3.api.domainGet;
          });
          Post.invoke(delegate, NULL);
        });
      }
      /** @internal */
      tryLocalValue(klass) {
        for (let i = 0; i < 16; i++) {
          const base = this.staticData.add(i * Process.pointerSize).readPointer();
          if (!base.isNull()) {
            const object = new Il2Cpp3.Object(base.readPointer()).asNullable();
            if (object?.class?.isSubclassOf(klass, false)) {
              return object;
            }
          }
        }
      }
    }
    __decorate([
      lazy
    ], Thread.prototype, "internal", null);
    __decorate([
      lazy
    ], Thread.prototype, "isFinalizer", null);
    __decorate([
      lazy
    ], Thread.prototype, "managedId", null);
    __decorate([
      lazy
    ], Thread.prototype, "object", null);
    __decorate([
      lazy
    ], Thread.prototype, "staticData", null);
    __decorate([
      lazy
    ], Thread.prototype, "synchronizationContext", null);
    Il2Cpp3.Thread = Thread;
    getter(Il2Cpp3, "attachedThreads", () => {
      return readNativeList(Il2Cpp3.api.threadGetAttachedThreads).map((_) => new Il2Cpp3.Thread(_));
    });
    getter(Il2Cpp3, "currentThread", () => {
      return new Il2Cpp3.Thread(Il2Cpp3.api.threadGetCurrent()).asNullable();
    });
    getter(Il2Cpp3, "mainThread", () => {
      return Il2Cpp3.attachedThreads[0];
    });
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    let Type = class Type extends NativeStruct {
      /** */
      static get enum() {
        const _ = (_2, block = (_3) => _3) => block(Il2Cpp3.corlib.class(_2)).type.typeEnum;
        return {
          void: _("System.Void"),
          boolean: _("System.Boolean"),
          char: _("System.Char"),
          byte: _("System.SByte"),
          unsignedByte: _("System.Byte"),
          short: _("System.Int16"),
          unsignedShort: _("System.UInt16"),
          int: _("System.Int32"),
          unsignedInt: _("System.UInt32"),
          long: _("System.Int64"),
          unsignedLong: _("System.UInt64"),
          nativePointer: _("System.IntPtr"),
          unsignedNativePointer: _("System.UIntPtr"),
          float: _("System.Single"),
          double: _("System.Double"),
          pointer: _("System.IntPtr", (_2) => _2.field("m_value")),
          valueType: _("System.Decimal"),
          object: _("System.Object"),
          string: _("System.String"),
          class: _("System.Array"),
          array: _("System.Void", (_2) => _2.arrayClass),
          multidimensionalArray: _("System.Void", (_2) => new Il2Cpp3.Class(Il2Cpp3.api.classGetArrayClass(_2, 2))),
          genericInstance: _("System.Int32", (_2) => _2.interfaces.find((_3) => _3.name.endsWith("`1")))
        };
      }
      /** Gets the class of this type. */
      get class() {
        return new Il2Cpp3.Class(Il2Cpp3.api.typeGetClass(this));
      }
      /** */
      get fridaAlias() {
        function getValueTypeFields(type) {
          const instanceFields = type.class.fields.filter((_) => !_.isStatic);
          return instanceFields.length == 0 ? ["char"] : instanceFields.map((_) => _.type.fridaAlias);
        }
        if (this.isByReference) {
          return "pointer";
        }
        switch (this.typeEnum) {
          case Il2Cpp3.Type.enum.void:
            return "void";
          case Il2Cpp3.Type.enum.boolean:
            return "bool";
          case Il2Cpp3.Type.enum.char:
            return "uchar";
          case Il2Cpp3.Type.enum.byte:
            return "int8";
          case Il2Cpp3.Type.enum.unsignedByte:
            return "uint8";
          case Il2Cpp3.Type.enum.short:
            return "int16";
          case Il2Cpp3.Type.enum.unsignedShort:
            return "uint16";
          case Il2Cpp3.Type.enum.int:
            return "int32";
          case Il2Cpp3.Type.enum.unsignedInt:
            return "uint32";
          case Il2Cpp3.Type.enum.long:
            return "int64";
          case Il2Cpp3.Type.enum.unsignedLong:
            return "uint64";
          case Il2Cpp3.Type.enum.float:
            return "float";
          case Il2Cpp3.Type.enum.double:
            return "double";
          case Il2Cpp3.Type.enum.nativePointer:
          case Il2Cpp3.Type.enum.unsignedNativePointer:
          case Il2Cpp3.Type.enum.pointer:
          case Il2Cpp3.Type.enum.string:
          case Il2Cpp3.Type.enum.array:
          case Il2Cpp3.Type.enum.multidimensionalArray:
            return "pointer";
          case Il2Cpp3.Type.enum.valueType:
            return this.class.isEnum ? this.class.baseType.fridaAlias : getValueTypeFields(this);
          case Il2Cpp3.Type.enum.class:
          case Il2Cpp3.Type.enum.object:
          case Il2Cpp3.Type.enum.genericInstance:
            return this.class.isStruct ? getValueTypeFields(this) : this.class.isEnum ? this.class.baseType.fridaAlias : "pointer";
          default:
            return "pointer";
        }
      }
      /** Determines whether this type is passed by reference. */
      get isByReference() {
        return this.name.endsWith("&");
      }
      /** Determines whether this type is primitive. */
      get isPrimitive() {
        switch (this.typeEnum) {
          case Il2Cpp3.Type.enum.boolean:
          case Il2Cpp3.Type.enum.char:
          case Il2Cpp3.Type.enum.byte:
          case Il2Cpp3.Type.enum.unsignedByte:
          case Il2Cpp3.Type.enum.short:
          case Il2Cpp3.Type.enum.unsignedShort:
          case Il2Cpp3.Type.enum.int:
          case Il2Cpp3.Type.enum.unsignedInt:
          case Il2Cpp3.Type.enum.long:
          case Il2Cpp3.Type.enum.unsignedLong:
          case Il2Cpp3.Type.enum.float:
          case Il2Cpp3.Type.enum.double:
          case Il2Cpp3.Type.enum.nativePointer:
          case Il2Cpp3.Type.enum.unsignedNativePointer:
            return true;
          default:
            return false;
        }
      }
      /** Gets the name of this type. */
      get name() {
        const handle = Il2Cpp3.api.typeGetName(this);
        try {
          return handle.readUtf8String();
        } finally {
          Il2Cpp3.free(handle);
        }
      }
      /** Gets the encompassing object of the current type. */
      get object() {
        return new Il2Cpp3.Object(Il2Cpp3.api.typeGetObject(this));
      }
      /** Gets the type enum of the current type. */
      get typeEnum() {
        return Il2Cpp3.api.typeGetTypeEnum(this);
      }
      /** */
      toString() {
        return this.name;
      }
    };
    __decorate([
      lazy
    ], Type.prototype, "class", null);
    __decorate([
      lazy
    ], Type.prototype, "fridaAlias", null);
    __decorate([
      lazy
    ], Type.prototype, "isByReference", null);
    __decorate([
      lazy
    ], Type.prototype, "isPrimitive", null);
    __decorate([
      lazy
    ], Type.prototype, "name", null);
    __decorate([
      lazy
    ], Type.prototype, "object", null);
    __decorate([
      lazy
    ], Type.prototype, "typeEnum", null);
    __decorate([
      lazy
    ], Type, "enum", null);
    Type = __decorate([
      recycle
    ], Type);
    Il2Cpp3.Type = Type;
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  var Il2Cpp2;
  (function(Il2Cpp3) {
    class ValueType extends NativeStruct {
      type;
      constructor(handle, type) {
        super(handle);
        this.type = type;
      }
      /** Boxes the current value type in a object. */
      box() {
        return new Il2Cpp3.Object(Il2Cpp3.api.valueTypeBox(this.type.class, this));
      }
      /** Gets the field with the given name. */
      field(name) {
        return this.type.class.field(name).withHolder(this);
      }
      /** Gets the method with the given name. */
      method(name, parameterCount = -1) {
        return this.type.class.method(name, parameterCount).withHolder(this);
      }
      /** Gets the field with the given name. */
      tryField(name) {
        return this.type.class.tryField(name)?.withHolder(this);
      }
      /** Gets the field with the given name. */
      tryMethod(name, parameterCount = -1) {
        return this.type.class.tryMethod(name, parameterCount)?.withHolder(this);
      }
      /** */
      toString() {
        const ToString = this.method("ToString", 0);
        return this.isNull() ? "null" : (
          // if ToString is defined within a value type class, we can
          // avoid a boxing operaion
          ToString.class.isValueType ? ToString.invoke().content ?? "null" : this.box().toString() ?? "null"
        );
      }
    }
    Il2Cpp3.ValueType = ValueType;
  })(Il2Cpp2 || (Il2Cpp2 = {}));
  globalThis.Il2Cpp = Il2Cpp2;

  // index.ts
  try {
    console.log("imported frida-il2cpp-bridge successfully");
  } catch (importError) {
    console.error("Error: importing frida-il2cpp-bridge : ", importError);
  }
  try {
    Il2Cpp.perform(() => {
      try {
        const SystemString = Il2Cpp.corlib.class("System.String");
        Il2Cpp.trace().classes(SystemString).filterMethods((method) => method.isStatic && method.returnType.equals(SystemString.type) && !method.isExternal).and().attach();
        Il2Cpp.trace(true).assemblies(Il2Cpp.corlib.assembly).filterClasses((klass) => klass.namespace == "System").filterParameters((param) => param.type.equals(SystemString) && param.name == "msg").and().assemblies(Il2Cpp.corlib.assembly).filterMethods((method) => method.name.toLowerCase().includes("begin")).and().attach();
      } catch (innerError) {
        console.error("Error: handling frida-il2cpp-bridge : ", innerError);
      }
    });
  } catch (outerError) {
    console.error("Error: initializing frida-il2cpp-bridge : ", outerError);
  }
})();
